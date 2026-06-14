package com.doppio.core.capture

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.doppio.BuildConfig
import com.doppio.core.data.SessionRepository
import com.doppio.core.network.ApiErrorType
import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.IngestRequestDto
import com.doppio.core.network.safeApiCall
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Stage 2 of the capture upload chain (stage 1 = [CaptureSessionWorker]): upload the
 * bytes to Storage → start the pipeline → poll → notify. Crucially this stage NEVER
 * creates a session — it reuses the target minted once by stage 1 (passed in as
 * chained input). So a [Result.retry] here re-uploads to the SAME session instead of
 * spawning a new "Queued" duplicate, which was the root cause of one recording
 * showing up as many queued items.
 *
 * The upload is a plain authenticated PUT to the Supabase signed-upload endpoint
 * (verified recipe: PUT /storage/v1/object/upload/sign/{bucket}/{path}?token=… with
 * x-upsert + apikey). We do it directly via OkHttp rather than through the storage
 * SDK, which was failing on-device and silently turning every recording into an empty
 * "Queued" session.
 */
@HiltWorker
class CaptureUploadWorker @AssistedInject constructor(
    @Assisted private val appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: DoppioApi,
    private val json: Json,
    private val sessionRepo: SessionRepository,
) : CoroutineWorker(appContext, params) {

    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val path = inputData.getString(KEY_PATH) ?: return Result.failure()
        val sessionId = inputData.getString(KEY_SESSION_ID) ?: return Result.failure()
        val bucket = inputData.getString(KEY_BUCKET) ?: return Result.failure()
        val uploadPath = inputData.getString(KEY_UPLOAD_PATH) ?: return Result.failure()
        val token = inputData.getString(KEY_TOKEN) ?: return Result.failure()
        val mime = inputData.getString(KEY_MIME) ?: "audio/mp4"
        val title = inputData.getString(KEY_TITLE)
        val durationSec = inputData.getInt(KEY_DURATION, 0).takeIf { it > 0 }
        val file = File(path)
        if (!file.exists() || file.length() == 0L) return Result.failure()

        // 1. Upload bytes to the signed-upload endpoint (idempotent via x-upsert, so a
        //    retry that re-PUTs the same object is fine). The real failure is logged +
        //    surfaced so a stuck upload is diagnosable.
        val uploadError = runCatching { putToSignedUrl(bucket, uploadPath, token, mime, file) }
            .exceptionOrNull()
        if (uploadError != null) {
            Log.e(TAG, "storage upload failed session=$sessionId attempt=$runAttemptCount", uploadError)
            return if (runAttemptCount < MAX_ATTEMPTS) {
                Result.retry()
            } else {
                CaptureNotifications.notifyDone(
                    appContext, title ?: file.name, ready = false,
                    detail = "Upload failed: ${uploadError.message ?: uploadError.javaClass.simpleName}",
                )
                Result.failure(workDataOf(KEY_ERROR to "upload: ${uploadError.message}"))
            }
        }

        // 2. Start the pipeline. A 409 (INVALID_STATE) means a prior attempt already
        //    started it — treat as success, not failure.
        val ingest = safeApiCall(json) { api.ingest(sessionId, IngestRequestDto(durationSec)) }
        if (ingest is ApiResult.Failure && ingest.type != ApiErrorType.InvalidState) {
            Log.e(TAG, "ingest failed session=$sessionId: ${ingest.message}")
            return if (ingest.type == ApiErrorType.Network && runAttemptCount < MAX_ATTEMPTS) {
                Result.retry()
            } else {
                CaptureNotifications.notifyDone(
                    appContext, title ?: file.name, ready = false,
                    detail = "Couldn't start transcription: ${ingest.message}",
                )
                Result.failure(workDataOf(KEY_ERROR to "ingest: ${ingest.message}"))
            }
        }

        // 3. Poll to terminal, refreshing Room so the UI updates, then notify.
        var status: String? = null
        val deadline = System.currentTimeMillis() + 5 * 60_000
        while (System.currentTimeMillis() < deadline) {
            delay(3_000)
            sessionRepo.refreshSession(sessionId)
            status = sessionRepo.statusOf(sessionId)
            if (status == "READY" || status == "FAILED") break
        }
        CaptureNotifications.notifyDone(appContext, title ?: file.name, ready = status == "READY")
        return if (status == "FAILED") Result.failure() else Result.success()
    }

    /** PUT the file to the Supabase signed-upload endpoint. Throws on non-2xx. */
    private suspend fun putToSignedUrl(
        bucket: String,
        uploadPath: String,
        token: String,
        mime: String,
        file: File,
    ) = withContext(Dispatchers.IO) {
        val url = "${BuildConfig.SUPABASE_URL}/storage/v1/object/upload/sign/$bucket/$uploadPath?token=$token"
        val request = Request.Builder()
            .url(url)
            .put(file.asRequestBody(mime.toMediaTypeOrNull()))
            .header("x-upsert", "true")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .build()
        http.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) {
                val body = runCatching { resp.body?.string()?.take(200) }.getOrNull()
                error("HTTP ${resp.code} ${resp.message} ${body ?: ""}".trim())
            }
        }
    }

    companion object {
        private const val TAG = "CaptureUpload"
        private const val MAX_ATTEMPTS = 4

        // Stage-1 input.
        const val KEY_PATH = "path"
        const val KEY_TITLE = "title"
        const val KEY_DURATION = "duration"
        const val KEY_MIME = "mime"

        // Stage-1 → stage-2: the minted upload target, reused across stage-2 retries.
        const val KEY_SESSION_ID = "sessionId"
        const val KEY_BUCKET = "bucket"
        const val KEY_UPLOAD_PATH = "uploadPath"
        const val KEY_TOKEN = "token"

        const val KEY_ERROR = "error"

        /** Input for stage 1 ([CaptureSessionWorker]). */
        fun data(path: String, title: String?, durationSec: Int?, mime: String) = workDataOf(
            KEY_PATH to path,
            KEY_TITLE to title,
            KEY_DURATION to (durationSec ?: 0),
            KEY_MIME to mime,
        )
    }
}