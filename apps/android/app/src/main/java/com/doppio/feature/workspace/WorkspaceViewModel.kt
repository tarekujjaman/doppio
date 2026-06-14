package com.doppio.feature.workspace

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.data.SessionRepository
import com.doppio.core.data.db.entity.SessionWithDetail
import com.doppio.core.network.ApiResult
import com.doppio.core.ui.SessionStatuses
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WorkspaceViewModel @Inject constructor(
    private val repo: SessionRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val sessionId: String = checkNotNull(savedStateHandle[ARG_ID])

    data class UiState(
        val detail: SessionWithDetail? = null,
        val refreshing: Boolean = false,
        val error: String? = null,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            repo.observeSession(sessionId).collect { detail ->
                _ui.update { it.copy(detail = detail) }
                ensurePolling()
            }
        }
        refresh()
    }

    fun refresh() {
        _ui.update { it.copy(refreshing = true, error = null) }
        viewModelScope.launch {
            when (val r = repo.refreshSession(sessionId)) {
                is ApiResult.Success -> _ui.update { it.copy(refreshing = false) }
                is ApiResult.Failure -> _ui.update { it.copy(refreshing = false, error = r.message) }
            }
        }
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

    companion object {
        const val ARG_ID = "id"
        private const val POLL_MS = 3_000L
    }
}
