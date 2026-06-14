package com.doppio.feature.workspace

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.doppio.core.data.SessionRepository
import com.doppio.core.data.db.entity.SessionWithDetail
import com.doppio.core.network.ApiResult
import com.doppio.core.network.AskClient
import com.doppio.core.network.AskEvent
import com.doppio.core.network.dto.AskCitationDto
import com.doppio.core.ui.SessionStatuses
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class WorkspaceViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val repo: SessionRepository,
    private val askClient: AskClient,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val sessionId: String = checkNotNull(savedStateHandle[ARG_ID])

    data class UiState(
        val detail: SessionWithDetail? = null,
        val localAudioPath: String? = null,
        val refreshing: Boolean = false,
        val busy: Boolean = false,
        val message: String? = null,
        val deleted: Boolean = false,
    )

    data class PlayerState(
        val available: Boolean = false,
        val isPlaying: Boolean = false,
        val positionMs: Long = 0,
        val durationMs: Long = 0,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private val _player = MutableStateFlow(PlayerState())
    val player: StateFlow<PlayerState> = _player.asStateFlow()

    data class AskMessage(
        val role: String, // "user" | "assistant"
        val text: String,
        val citations: List<AskCitationDto> = emptyList(),
    )

    data class AskState(
        val messages: List<AskMessage> = emptyList(),
        val input: String = "",
        val asking: Boolean = false,
    )

    private val _ask = MutableStateFlow(AskState())
    val ask: StateFlow<AskState> = _ask.asStateFlow()
    private var threadId: String? = null
    private var askJob: Job? = null

    private var exo: ExoPlayer? = null
    private var posJob: Job? = null
    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            repo.observeSession(sessionId).collect { detail ->
                _ui.update { it.copy(detail = detail) }
                ensurePolling()
            }
        }
        viewModelScope.launch {
            repo.observeLocalAudio(sessionId).collect { audio -> setupPlayer(audio?.filePath) }
        }
        refresh()
    }

    fun refresh() {
        _ui.update { it.copy(refreshing = true, message = null) }
        viewModelScope.launch {
            when (val r = repo.refreshSession(sessionId)) {
                is ApiResult.Success -> _ui.update { it.copy(refreshing = false) }
                is ApiResult.Failure -> _ui.update { it.copy(refreshing = false, message = r.message) }
            }
        }
    }

    // --- Mutations ---------------------------------------------------------

    fun rename(title: String) = action { repo.rename(sessionId, title.trim()) }
    fun toggleAction(id: String, done: Boolean) = action { repo.setActionDone(id, done) }
    fun deleteNote(id: String) = action { repo.deleteNote(id, sessionId) }
    fun regenerate() = action { repo.regenerateSummary(sessionId) }

    fun addNote(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val anchor = if (_player.value.available) _player.value.positionMs.toInt() else null
        action { repo.addNote(sessionId, trimmed, anchor) }
    }

    fun deleteSession() {
        viewModelScope.launch {
            when (val r = repo.deleteSession(sessionId)) {
                is ApiResult.Success -> _ui.update { it.copy(deleted = true) }
                is ApiResult.Failure -> _ui.update { it.copy(message = r.message) }
            }
        }
    }

    fun deleteLocalAudio() {
        viewModelScope.launch {
            releasePlayer()
            repo.deleteLocalAudio(sessionId)
        }
    }

    fun clearMessage() = _ui.update { it.copy(message = null) }

    // --- Ask (SSE) ---------------------------------------------------------

    fun onAskInput(value: String) = _ask.update { it.copy(input = value) }

    fun sendQuestion() {
        val q = _ask.value.input.trim()
        if (q.isEmpty() || _ask.value.asking) return
        _ask.update {
            it.copy(
                input = "",
                asking = true,
                messages = it.messages + AskMessage("user", q) + AskMessage("assistant", ""),
            )
        }
        askJob?.cancel()
        askJob = viewModelScope.launch {
            askClient.stream(sessionId, q, threadId).collect { event ->
                when (event) {
                    is AskEvent.Meta -> threadId = event.threadId ?: threadId
                    is AskEvent.Delta -> _ask.update { st ->
                        val last = st.messages.last()
                        st.copy(messages = st.messages.dropLast(1) + last.copy(text = last.text + event.text))
                    }
                    is AskEvent.Done -> _ask.update { st ->
                        val last = st.messages.last()
                        st.copy(asking = false, messages = st.messages.dropLast(1) + last.copy(citations = event.citations))
                    }
                    is AskEvent.Error -> _ask.update { st ->
                        st.copy(
                            asking = false,
                            messages = st.messages.dropLast(1) + AskMessage("assistant", "⚠️ ${event.message}"),
                        )
                    }
                }
            }
        }
    }

    private fun action(block: suspend () -> ApiResult<Unit>) {
        viewModelScope.launch {
            _ui.update { it.copy(busy = true) }
            val r = block()
            _ui.update {
                it.copy(busy = false, message = (r as? ApiResult.Failure)?.message)
            }
        }
    }

    // --- Player ------------------------------------------------------------

    fun playPause() {
        val p = exo ?: return
        if (p.isPlaying) p.pause() else p.play()
    }

    fun seekTo(ms: Long) {
        exo?.seekTo(ms)
        _player.update { it.copy(positionMs = ms) }
    }

    private fun setupPlayer(path: String?) {
        if (path == null || !File(path).exists()) {
            releasePlayer()
            _ui.update { it.copy(localAudioPath = null) }
            _player.update { PlayerState(available = false) }
            return
        }
        _ui.update { it.copy(localAudioPath = path) }
        if (exo != null) return
        exo = ExoPlayer.Builder(appContext).build().apply {
            setMediaItem(MediaItem.fromUri(Uri.fromFile(File(path))))
            prepare()
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    _player.update { it.copy(isPlaying = isPlaying) }
                    if (isPlaying) startPositionUpdates()
                }
            })
        }
        _player.update { it.copy(available = true) }
    }

    private fun startPositionUpdates() {
        posJob?.cancel()
        posJob = viewModelScope.launch {
            while (exo?.isPlaying == true) {
                exo?.let { p ->
                    _player.update {
                        it.copy(positionMs = p.currentPosition, durationMs = p.duration.coerceAtLeast(0))
                    }
                }
                delay(200)
            }
            _player.update { it.copy(positionMs = exo?.currentPosition ?: 0) }
        }
    }

    private fun releasePlayer() {
        posJob?.cancel()
        exo?.release()
        exo = null
    }

    private fun ensurePolling() {
        val status = _ui.value.detail?.session?.status ?: return
        if (SessionStatuses.isInFlight(status) && pollJob?.isActive != true) {
            pollJob = viewModelScope.launch {
                while (_ui.value.detail?.session?.status?.let(SessionStatuses::isInFlight) == true) {
                    delay(POLL_MS)
                    repo.refreshSession(sessionId)
                }
            }
        }
    }

    override fun onCleared() {
        releasePlayer()
    }

    companion object {
        const val ARG_ID = "id"
        private const val POLL_MS = 3_000L
    }
}
