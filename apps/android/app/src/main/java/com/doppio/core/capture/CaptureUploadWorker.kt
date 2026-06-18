package com.doppio.core.capture

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.doppio.core.data.SessionRepository
import com.doppio.core.data.db.dao.LocalAudioDao
import com.doppio.core.data.db.entity.LocalAudioEntity
import com.doppio.core.network.ApiErrorType
import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.IngestRequestDto
import com.doppio.core.network.dto.UploadUrlRequestDto
import com.doppio.core.network.safeApiCall
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Reliable capture upload (survives navigation / process death):
 * upload-url → direct Supabase Storage upload → ingest → poll → notify. The local
 * .m4a is linked to the session up front so playback works even though the cloud
 * copy is deleted after transcription.
 */
@HiltWorker
class CaptureUploadWorker @AssistedInject constructor(
    @Assisted private val appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: DoppioApi,
    private val supabase: SupabaseClient,
    private val json: Json,
    private val localAudioDao: LocalAudioDao,
    private val sessionRepo: SessionRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val path = inputData.getString(KEY_PATH) ?: return Result.failure()
        val title = inputData.getString(KEY_TITLE)
        val durationSec = inputData.getInt(KEY_DURATION, 0).takeIf { it > 0 }
        val mime = inputData.getString(KEY_MIME) ?: "audio/mp4"
        val file = File(path)
        if (!file.exists() || file.length() == 0L) return Result.failure()

        // 1. Signed upload target (+ early quota gate server-side).
        val target = when (val r = safeApiCall(json) {
            api.createUploadUrl(
                UploadUrlRequestDto(file.name, mime, file.length(), durationSec, "MOBILE", title),
            )
        }) {
            is ApiResult.Success -> r.data
            is ApiResult.Failure -> return if (r.type == ApiErrorType.Network) Result.retry() else Result.failure()
        }

        // Link the on-device file to the session immediately (offline playback source).
        localAudioDao.upsert(
            LocalAudioEntity(target.sessionId, path, mime, durationSec, file.length(), System.currentTimeMillis()),
        )

        // 2. Upload bytes straight to Storage (bypasses Vercel's request-body cap).
        val uploaded = runCatching {
            supabase.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file.readBytes())
        }
        if (uploaded.isFailure) return Result.retry()

        // 3. Start the pipeline (server transcribes, then deletes the cloud audio).
        val ingest = safeApiCall(json) { api.ingest(target.sessionId, IngestRequestDto(durationSec)) }
        if (ingest is ApiResult.Failure) {
            return if (ingest.type == ApiErrorType.Network) Result.retry() else Result.failure()
        }

        // 4. Poll to terminal, refreshing Room so the UI updates, then notify.
        var status: String? = null
        val deadline = System.currentTimeMillis() + 5 * 60_000
        while (System.currentTimeMillis() < deadline) {
            delay(3_000)
            sessionRepo.refreshSession(target.sessionId)
            status = sessionRepo.statusOf(target.sessionId)
            if (status == "READY" || status == "FAILED") break
        }
        CaptureNotifications.notifyDone(appContext, title ?: file.name, ready = status == "READY")
        return if (status == "FAILED") Result.failure() else Result.success()
    }

    companion object {
        const val KEY_PATH = "path"
        const val KEY_TITLE = "title"
        const val KEY_DURATION = "duration"
        const val KEY_MIME = "mime"

        fun data(path: String, title: String?, durationSec: Int?, mime: String) = workDataOf(
            KEY_PATH to path,
            KEY_TITLE to title,
            KEY_DURATION to (durationSec ?: 0),
            KEY_MIME to mime,
        )
    }
}
