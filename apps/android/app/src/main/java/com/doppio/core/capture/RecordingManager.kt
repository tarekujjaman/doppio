package com.doppio.core.capture

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.doppio.core.data.SessionRepository
import com.doppio.core.network.ApiResult
import com.doppio.core.network.dto.UploadUrlResponseDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide owner of the recording lifecycle. Centralizing start/pause/stop/upload
 * here (instead of in a screen ViewModel) lets the recording be controlled from
 * anywhere — the capture screen AND the global recording bar shown on other screens.
 */
@Singleton
class RecordingManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val recorder: RecorderController,
    private val sessionRepo: SessionRepository,
) {
    val state: StateFlow<RecorderController.State> = recorder.state

    fun start(): Boolean {
        val ok = recorder.start()
        if (ok) RecordingService.start(context)
        return ok
    }

    fun pause() = recorder.pause()
    fun resume() = recorder.resume()

    fun discard() {
        recorder.cancel()
        RecordingService.stop(context)
    }

    /**
     * Stops the recording, creates the session up front, and enqueues the upload.
     * Returns the new session id (so the caller can navigate to its workspace), or
     * null on an empty take / when the session couldn't be created synchronously
     * (in which case the resilient 2-stage chain takes over in the background).
     */
    suspend fun stopAndUpload(title: String? = null): String? {
        val durationSec = (recorder.elapsedMs() / 1000).toInt().coerceAtLeast(1)
        val file = recorder.stop()
        RecordingService.stop(context)
        if (file == null) return null
        val t = title ?: defaultTitle("Recording")
        return when (val r = sessionRepo.createRecordingSession(file.absolutePath, recorder.mimeType, durationSec, t)) {
            is ApiResult.Success -> {
                enqueueUpload(file.absolutePath, recorder.mimeType, durationSec, t, r.data)
                r.data.sessionId
            }
            is ApiResult.Failure -> {
                enqueue(file.absolutePath, durationSec, recorder.mimeType, t)
                null
            }
        }
    }

    /** Enqueue an imported audio file (server derives duration) via the 2-stage chain. */
    fun enqueueImport(path: String, mime: String, title: String? = null) =
        enqueue(path, 0, mime, title ?: defaultTitle("Imported audio"))

    /** Stage-2-only upload when the session/target was already created synchronously. */
    private fun enqueueUpload(
        path: String,
        mime: String,
        durationSec: Int,
        title: String,
        target: UploadUrlResponseDto,
    ) {
        val upload = OneTimeWorkRequestBuilder<CaptureUploadWorker>()
            .setInputData(
                workDataOf(
                    CaptureUploadWorker.KEY_PATH to path,
                    CaptureUploadWorker.KEY_TITLE to title,
                    CaptureUploadWorker.KEY_DURATION to durationSec,
                    CaptureUploadWorker.KEY_MIME to mime,
                    CaptureUploadWorker.KEY_SESSION_ID to target.sessionId,
                    CaptureUploadWorker.KEY_BUCKET to target.bucket,
                    CaptureUploadWorker.KEY_UPLOAD_PATH to target.path,
                    CaptureUploadWorker.KEY_TOKEN to target.token,
                ),
            )
            .setConstraints(networkConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork("capture-upload:$path", ExistingWorkPolicy.KEEP, upload)
    }

    /** Full 2-stage chain (creates the session in stage 1) — import + offline fallback. */
    private fun enqueue(path: String, durationSec: Int, mime: String, title: String) {
        val createSession = OneTimeWorkRequestBuilder<CaptureSessionWorker>()
            .setInputData(CaptureUploadWorker.data(path, title, durationSec, mime))
            .setConstraints(networkConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        val upload = OneTimeWorkRequestBuilder<CaptureUploadWorker>()
            .setConstraints(networkConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .beginUniqueWork("capture-upload:$path", ExistingWorkPolicy.KEEP, createSession)
            .then(upload)
            .enqueue()
    }

    private fun networkConstraints() =
        Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** Human default title (the AI title replaces it once summarize runs). */
    private fun defaultTitle(prefix: String): String =
        "$prefix · " + SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date())
}
