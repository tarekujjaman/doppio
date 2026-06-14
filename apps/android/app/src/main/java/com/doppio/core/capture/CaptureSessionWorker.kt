package com.doppio.core.capture

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.doppio.core.data.db.dao.LocalAudioDao
import com.doppio.core.data.db.entity.LocalAudioEntity
import com.doppio.core.network.ApiErrorType
import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.UploadUrlRequestDto
import com.doppio.core.network.safeApiCall
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Stage 1 of the capture upload chain. Creates the server session + signed upload
 * target EXACTLY ONCE and hands it to stage 2 ([CaptureUploadWorker]) as chained
 * output. Splitting this out is what fixes the "one recording → many Queued sessions"
 * bug: previously the single worker called createUploadUrl at the top of doWork, so
 * every WorkManager retry of a flaky upload/ingest minted a brand-new session.
 *
 * This stage only retries on a network error (when no session was created), so it is
 * effectively run-once: on success it returns and never re-creates.
 */
@HiltWorker
class CaptureSessionWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val api: DoppioApi,
    private val json: Json,
    private val localAudioDao: LocalAudioDao,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val path = inputData.getString(CaptureUploadWorker.KEY_PATH) ?: return Result.failure()
        val title = inputData.getString(CaptureUploadWorker.KEY_TITLE)
        val durationSec = inputData.getInt(CaptureUploadWorker.KEY_DURATION, 0).takeIf { it > 0 }
        val mime = inputData.getString(CaptureUploadWorker.KEY_MIME) ?: "audio/mp4"
        val file = File(path)
        if (!file.exists() || file.length() == 0L) return Result.failure()

        val target = when (
            val r = safeApiCall(json) {
                api.createUploadUrl(
                    UploadUrlRequestDto(file.name, mime, file.length(), durationSec, "MOBILE", title),
                )
            }
        ) {
            is ApiResult.Success -> r.data
            // Only a network error is safe to retry here (no session was created yet).
            is ApiResult.Failure -> {
                Log.e(TAG, "createUploadUrl failed: ${r.message}")
                return if (r.type == ApiErrorType.Network) Result.retry() else Result.failure()
            }
        }

        // Link the on-device file to the session up front: the permanent local copy
        // powers offline playback even after the cloud audio is deleted post-transcription.
        localAudioDao.upsert(
            LocalAudioEntity(target.sessionId, path, mime, durationSec, file.length(), System.currentTimeMillis()),
        )

        return Result.success(
            workDataOf(
                CaptureUploadWorker.KEY_PATH to path,
                CaptureUploadWorker.KEY_TITLE to title,
                CaptureUploadWorker.KEY_DURATION to (durationSec ?: 0),
                CaptureUploadWorker.KEY_MIME to mime,
                CaptureUploadWorker.KEY_SESSION_ID to target.sessionId,
                CaptureUploadWorker.KEY_BUCKET to target.bucket,
                CaptureUploadWorker.KEY_UPLOAD_PATH to target.path,
                CaptureUploadWorker.KEY_TOKEN to target.token,
            ),
        )
    }

    private companion object {
        const val TAG = "CaptureSession"
    }
}