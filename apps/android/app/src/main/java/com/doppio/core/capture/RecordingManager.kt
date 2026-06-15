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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
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
 * App-wide owner of the recording lifecycle. The RECORD path is **near-real-time** AND
 * **instant-start**: tapping Record begins local 16 kHz mono capture ([LiveRecorder])
 * immediately — no network on the tap path — while the server session is opened in the
 * background. Chunks captured before the session id lands are buffered, then flushed; once
 * the id is known they POST straight to /transcribe-chunk so the transcript builds WHILE
 * recording and Stop → READY lands in seconds. (The old design awaited a serverless
 * round-trip before the recorder even started, so the button looked dead and repeated taps
 * spawned duplicate sessions.) The IMPORT path keeps the resilient 2-stage WorkManager
 * chain. Controllable from anywhere (capture screen + the global recording bar).
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

    // Lifecycle guards — touched from the main thread, the IO scope, and the recorder thread.
    @Volatile private var active = false
    @Volatile private var sessionId: String? = null
    @Volatile private var sessionReady: CompletableDeferred<String?>? = null
    @Volatile private var localTitle: String = ""
    private val chunkLock = Any()
    private val pending = ArrayList<Triple<Int, Long, ByteArray>>()
    private val pendingChunks = AtomicInteger(0)

    /**
     * Start capturing **immediately** (local mic, zero network on this path) and open the
     * server session in the background. Synchronous + fast so the UI flips to "Recording"
     * the instant the user taps. Re-entrant calls are ignored (double-tap guard). Returns
     * false only if the mic couldn't be opened.
     */
    fun start(): Boolean {
        if (active || recorder.state.value.status != RecorderController.Status.Idle) return false
        active = true

        synchronized(chunkLock) {
            sessionId = null
            pending.clear()
        }
        val ready = CompletableDeferred<String?>()
        sessionReady = ready
        localTitle = defaultTitle("Recording")

        // Buffer chunks until the session id lands; after that they POST directly.
        recorder.onChunk = { index, startMs, wav -> onChunkReady(index, startMs, wav) }

        val ok = recorder.start()
        if (!ok) {
            recorder.onChunk = null
            active = false
            ready.complete(null)
            return false
        }
        RecordingService.start(context)

        // Open the server session off the tap path. Buffered chunks flush once it lands.
        scope.launch {
            val sid = when (val r = safeApiCall(json) {
                api.startLive(StartLiveRequestDto(source = "MOBILE", title = localTitle))
            }) {
                is ApiResult.Success -> r.data.sessionId
                is ApiResult.Failure -> null
            }
            if (sid != null) {
                runCatching { sessionRepo.insertLiveSession(sid, localTitle) }
                val toPost = synchronized(chunkLock) {
                    sessionId = sid
                    val copy = pending.toList()
                    pending.clear()
                    copy
                }
                toPost.forEach { postChunk(sid, it.first, it.second, it.third) }
            }
            ready.complete(sid)
        }
        return true
    }

    fun pause() = recorder.pause()
    fun resume() = recorder.resume()

    /** Abandon the recording and delete the server session (once/if it was created). */
    fun discard() {
        recorder.onChunk = null
        RecordingService.stop(context)
        val sid = sessionId
        val ready = sessionReady
        active = false
        sessionId = null
        sessionReady = null
        synchronized(chunkLock) { pending.clear() }
        scope.launch {
            runCatching { recorder.cancel() } // blocking join — keep off the main thread
            val id = sid ?: ready?.let { withTimeoutOrNull(SESSION_WAIT_MS) { it.await() } }
            if (id != null) runCatching { sessionRepo.deleteSession(id) }
        }
    }

    /**
     * Stop, drain the remaining chunk(s), and finalize → summary/READY. Returns the session
     * id so the caller can open its workspace. The transcript is already streamed in, so
     * finalize is fast. If the server session never got created (offline/down) the recording
     * is NOT lost — it falls back to the resilient file-upload path.
     */
    suspend fun stopAndUpload(title: String? = null): String? {
        if (!active) return null
        active = false
        val durationSec = (recorder.elapsedMs() / 1000).toInt().coerceAtLeast(1)
        val file = withContext(Dispatchers.IO) { recorder.stop() } // emits the final chunk
        RecordingService.stop(context)
        recorder.onChunk = null

        // Wait (bounded) for the background session creation to finish.
        val sid = sessionId ?: withTimeoutOrNull(SESSION_WAIT_MS) { sessionReady?.await() }
        sessionReady = null

        if (sid == null) {
            sessionId = null
            synchronized(chunkLock) { pending.clear() }
            if (file != null) enqueueImport(file.absolutePath, "audio/wav", localTitle)
            return null
        }

        flushPending(sid) // post anything buffered (e.g. the final chunk) before finalizing
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

    /** Called on the recorder thread for each WAV chunk. Posts if the id is known, else buffers. */
    private fun onChunkReady(index: Int, startMs: Long, wav: ByteArray) {
        val sid = synchronized(chunkLock) {
            val s = sessionId
            if (s == null) {
                pending.add(Triple(index, startMs, wav))
                null
            } else {
                s
            }
        }
        if (sid != null) postChunk(sid, index, startMs, wav)
    }

    private fun flushPending(sid: String) {
        val toPost = synchronized(chunkLock) {
            val copy = pending.toList()
            pending.clear()
            copy
        }
        toPost.forEach { postChunk(sid, it.first, it.second, it.third) }
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
        const val SESSION_WAIT_MS = 20_000L
    }
}
