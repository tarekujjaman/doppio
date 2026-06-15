package com.doppio.core.capture

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.doppio.BuildConfig
import com.doppio.core.data.SessionRepository
import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.FinalizeRequestDto
import com.doppio.core.network.dto.StartLiveRequestDto
import com.doppio.core.network.safeApiCall
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide owner of the recording lifecycle. The RECORD path is **near-real-time**:
 * AudioRecord captures 16 kHz mono PCM ([LiveRecorder]) cut into ~90s WAV chunks that
 * are transcribed WHILE recording (POST /transcribe-chunk), so Stop → READY lands in
 * seconds (finalize just summarizes the already-streamed transcript). The IMPORT path
 * keeps the file-upload 2-stage WorkManager chain. Controllable from anywhere (capture
 * screen + the global recording bar) since it's a singleton with a stable API.
 */
@Singleton
class RecordingManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val recorder: LiveRecorder,
    private val api: DoppioApi,
    private val json: Json,
    private val httpClient: OkHttpClient,
    private val sessionRepo: SessionRepository,
) {
    val state: StateFlow<RecorderController.State> = recorder.state

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var sessionId: String? = null
    private val pendingChunks = AtomicInteger(0)

    /** Open a live session, then start streaming chunks. Returns false if it couldn't start. */
    suspend fun start(): Boolean {
        val title = defaultTitle("Recording")
        val sid = when (val r = safeApiCall(json) { api.startLive(StartLiveRequestDto(source = "MOBILE", title = title)) }) {
            is ApiResult.Success -> r.data.sessionId
            is ApiResult.Failure -> return false
        }
        sessionId = sid
        runCatching { sessionRepo.insertLiveSession(sid, title) }
        recorder.onChunk = { index, startMs, wav -> postChunk(sid, index, startMs, wav) }
        val ok = recorder.start()
        if (ok) {
            RecordingService.start(context)
        } else {
            recorder.onChunk = null
            sessionId = null
            scope.launch { runCatching { sessionRepo.deleteSession(sid) } }
        }
        return ok
    }

    fun pause() = recorder.pause()
    fun resume() = recorder.resume()

    fun discard() {
        val sid = sessionId
        recorder.onChunk = null
        recorder.cancel()
        RecordingService.stop(context)
        sessionId = null
        if (sid != null) scope.launch { runCatching { sessionRepo.deleteSession(sid) } }
    }

    /**
     * Stop the recording, drain the remaining chunk(s), and finalize → summary/READY.
     * Returns the session id (so the caller can open its workspace). The transcript is
     * already streamed in, so finalize is fast.
     */
    suspend fun stopAndUpload(title: String? = null): String? {
        val sid = sessionId ?: return null
        val durationSec = (recorder.elapsedMs() / 1000).toInt().coerceAtLeast(1)
        val file = recorder.stop() // emits the final chunk synchronously → postChunk launches
        RecordingService.stop(context)
        recorder.onChunk = null
        sessionId = null
        if (file != null) {
            runCatching {
                sessionRepo.linkLocalAudio(sid, file.absolutePath, "audio/wav", durationSec, file.length())
            }
        }
        drainChunks()
        safeApiCall(json) { api.finalizeLive(sid, FinalizeRequestDto(durationSec)) }
        return sid
    }

    /** POST one WAV chunk to the live session (Bearer added by the shared OkHttp client). */
    private fun postChunk(sid: String, index: Int, startMs: Long, wav: ByteArray) {
        pendingChunks.incrementAndGet()
        scope.launch {
            try {
                val url = "${BuildConfig.API_BASE_URL.trimEnd('/')}/api/sessions/$sid/transcribe-chunk?index=$index&startMs=$startMs"
                repeat(3) {
                    val done = runCatching {
                        val req = Request.Builder()
                            .url(url)
                            .post(wav.toRequestBody("audio/wav".toMediaTypeOrNull()))
                            .build()
                        httpClient.newCall(req).execute().use { resp -> resp.isSuccessful || resp.code in NON_RETRYABLE }
                    }.getOrDefault(false)
                    if (done) return@launch
                    delay(1500)
                }
            } finally {
                pendingChunks.decrementAndGet()
            }
        }
    }

    private suspend fun drainChunks() {
        var waited = 0
        while (pendingChunks.get() > 0 && waited < 60_000) {
            delay(500)
            waited += 500
        }
    }

    // ── Import path (file upload via the resilient 2-stage WorkManager chain) ──
    fun enqueueImport(path: String, mime: String, title: String? = null) {
        val t = title ?: defaultTitle("Imported audio")
        val createSession = OneTimeWorkRequestBuilder<CaptureSessionWorker>()
            .setInputData(CaptureUploadWorker.data(path, t, 0, mime))
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

    private companion object {
        val NON_RETRYABLE = setOf(400, 401, 402, 404, 409, 413)
    }
}
