package com.doppio.feature.capture

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.capture.AudioStore
import com.doppio.core.capture.RecorderController
import com.doppio.core.capture.RecordingManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CaptureViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val recording: RecordingManager,
    private val audioStore: AudioStore,
) : ViewModel() {

    enum class Phase { Idle, Recording, Submitted, Error }

    data class UiState(val phase: Phase = Phase.Idle, val message: String? = null)

    val recorderState: StateFlow<RecorderController.State> = recording.state

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    // One-shot: emits the new session id so the screen can open its workspace.
    private val _openSession = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val openSession: SharedFlow<String> = _openSession.asSharedFlow()

    fun startRecording() {
        viewModelScope.launch {
            if (recording.start()) {
                _ui.update { UiState(phase = Phase.Recording) }
            } else {
                _ui.update { UiState(phase = Phase.Error, message = "Couldn't start — check your connection") }
            }
        }
    }

    fun pause() = recording.pause()
    fun resume() = recording.resume()

    fun discard() {
        recording.discard()
        _ui.update { UiState() }
    }

    fun stopAndUpload() {
        _ui.update { UiState(phase = Phase.Submitted) }
        viewModelScope.launch {
            val id = recording.stopAndUpload()
            if (id != null) _openSession.emit(id)
            // else: the resilient chain is running; the item appears in the library shortly.
        }
    }

    fun importFile(uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            val mime = context.contentResolver.getType(uri) ?: "audio/mp4"
            val file = audioStore.newImportFile(System.currentTimeMillis(), extForMime(mime))
            val ok = runCatching {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    file.outputStream().use { input.copyTo(it) }
                }
                file.length() > 0
            }.getOrDefault(false)

            if (ok) {
                recording.enqueueImport(file.absolutePath, mime)
                _ui.update { UiState(phase = Phase.Submitted) }
            } else {
                file.delete()
                _ui.update { UiState(phase = Phase.Error, message = "Couldn't read that file") }
            }
        }
    }

    fun reset() = _ui.update { UiState() }

    private fun extForMime(mime: String): String = when {
        mime.contains("mpeg") || mime.contains("mp3") -> "mp3"
        mime.contains("wav") -> "wav"
        mime.contains("ogg") -> "ogg"
        mime.contains("flac") -> "flac"
        mime.contains("aac") -> "aac"
        else -> "m4a"
    }
}
