package com.doppio.feature.capture

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.doppio.core.capture.AudioStore
import com.doppio.core.capture.CaptureSessionWorker
import com.doppio.core.capture.CaptureUploadWorker
import com.doppio.core.capture.RecorderController
import com.doppio.core.capture.RecordingService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@HiltViewModel
class CaptureViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val recorder: RecorderController,
    private val audioStore: AudioStore,
) : ViewModel() {

    enum class Phase { Idle, Recording, Submitted, Error }

    data class UiState(val phase: Phase = Phase.Idle, val message: String? = null)

    val recorderState: StateFlow<RecorderController.State> = recorder.state

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    fun startRecording() {
        if (recorder.start()) {
            // Keep capture alive with the screen off / app backgrounded.
            RecordingService.start(context)
            _ui.update { UiState(phase = Phase.Recording) }
        } else {
            _ui.update { UiState(phase = Phase.Error, message = "Couldn't start recording") }
        }
    }

    fun pause() = recorder.pause()
    fun resume() = recorder.resume()

    fun discard() {
        recorder.cancel()
        RecordingService.stop(context)
        _ui.update { UiState() }
    }

    fun stopAndUpload() {
        val durationSec = (recorder.elapsedMs() / 1000).toInt().coerceAtLeast(1)
        val file = recorder.stop()
        RecordingService.stop(context)
        if (file == null) {
            _ui.update { UiState() }
            return
        }
        enqueue(file.absolutePath, durationSec, recorder.mimeType)
        _ui.update { UiState(phase = Phase.Submitted) }
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
                enqueue(file.absolutePath, durationSec = 0, mime = mime) // server derives duration
                _ui.update { UiState(phase = Phase.Submitted) }
            } else {
                file.delete()
                _ui.update { UiState(phase = Phase.Error, message = "Couldn't read that file") }
            }
        }
    }

    fun reset() = _ui.update { UiState() }

    private fun enqueue(path: String, durationSec: Int, mime: String) {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        // Stage 1: create the session/upload-URL once.
        val createSession = OneTimeWorkRequestBuilder<CaptureSessionWorker>()
            .setInputData(CaptureUploadWorker.data(path, title = null, durationSec = durationSec, mime = mime))
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()

        // Stage 2: upload → ingest → poll (retries reuse stage 1's session — no dupes).
        val upload = OneTimeWorkRequestBuilder<CaptureUploadWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()

        // Unique per recording file so re-entering the screen / re-enqueue can't fan
        // the same take out into multiple chains.
        WorkManager.getInstance(context)
            .beginUniqueWork("capture-upload:$path", ExistingWorkPolicy.KEEP, createSession)
            .then(upload)
            .enqueue()
    }

    private fun extForMime(mime: String): String = when {
        mime.contains("mpeg") || mime.contains("mp3") -> "mp3"
        mime.contains("wav") -> "wav"
        mime.contains("ogg") -> "ogg"
        mime.contains("flac") -> "flac"
        mime.contains("aac") -> "aac"
        else -> "m4a"
    }
}
