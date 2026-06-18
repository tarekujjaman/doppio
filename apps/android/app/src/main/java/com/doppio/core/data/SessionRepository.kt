package com.doppio.core.data

import androidx.room.withTransaction
import com.doppio.core.capture.AudioStore
import com.doppio.core.data.db.DoppioDatabase
import com.doppio.core.data.db.dao.ActionItemDao
import com.doppio.core.data.db.dao.LocalAudioDao
import com.doppio.core.data.db.dao.NoteDao
import com.doppio.core.data.db.dao.SessionDao
import com.doppio.core.data.db.dao.SummaryDao
import com.doppio.core.data.db.dao.TranscriptDao
import com.doppio.core.data.db.entity.LocalAudioEntity
import com.doppio.core.data.db.entity.NoteEntity
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.data.db.entity.SessionWithDetail
import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.AddNoteDto
import com.doppio.core.network.dto.UpdateActionItemDto
import com.doppio.core.network.dto.UpdateSessionDto
import com.doppio.core.network.dto.UploadUrlRequestDto
import com.doppio.core.network.dto.UploadUrlResponseDto
import java.io.File
import java.time.Instant
import com.doppio.core.network.safeApiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Offline-first session repository: the UI observes Room ([observeSessions] /
 * [observeSession]); the `refresh*` calls hit the network and write back, so
 * screens render cached data immediately and update when the fetch lands.
 */
@Singleton
class SessionRepository @Inject constructor(
    private val api: DoppioApi,
    private val json: Json,
    private val db: DoppioDatabase,
    private val sessionDao: SessionDao,
    private val transcriptDao: TranscriptDao,
    private val summaryDao: SummaryDao,
    private val actionItemDao: ActionItemDao,
    private val noteDao: NoteDao,
    private val localAudioDao: LocalAudioDao,
    private val audioStore: AudioStore,
) {
    fun observeSessions(): Flow<List<SessionEntity>> = sessionDao.observeAll()

    fun observeSession(id: String): Flow<SessionWithDetail?> = sessionDao.observeDetail(id)

    fun observeLocalAudio(id: String): Flow<LocalAudioEntity?> = localAudioDao.observe(id)

    /** Fetches a page of the list into Room; returns the next cursor (or null).
     *  A full refresh (no cursor) REPLACES the cached list so server-side deletions
     *  propagate — previously deleted sessions lingered in the local cache forever. */
    suspend fun refreshSessions(query: String? = null, cursor: String? = null): ApiResult<String?> =
        when (val result = safeApiCall(json) { api.listSessions(query = query, cursor = cursor) }) {
            is ApiResult.Success -> {
                val entities = result.data.sessions.map { it.toEntity() }
                if (cursor == null && query.isNullOrBlank()) {
                    db.withTransaction {
                        sessionDao.clearAll()
                        sessionDao.upsertSummaries(entities)
                    }
                } else {
                    sessionDao.upsertSummaries(entities)
                }
                ApiResult.Success(result.data.nextCursor)
            }
            is ApiResult.Failure -> result
        }

    /**
     * Fetches full detail (transcript/summary/actions/notes) into Room. Uses upsert-in-place
     * (REPLACE by primary key) + prune-stale instead of delete-all-then-reinsert, so the
     * workspace's 3s status poll never momentarily empties a table — that delete→insert window
     * was what made the Summary/Transcript tabs blink while a session was still processing.
     */
    suspend fun refreshSession(id: String): ApiResult<Unit> =
        when (val result = safeApiCall(json) { api.getSession(id) }) {
            is ApiResult.Success -> {
                val s = result.data.session
                db.withTransaction {
                    sessionDao.upsertSession(s.toEntity())

                    // Transcript is append-only — never clear on a transient empty response.
                    if (s.transcript.isNotEmpty()) {
                        val segs = s.transcript.map { it.toEntity(id) }
                        transcriptDao.insertAll(segs)
                        transcriptDao.deleteStale(id, segs.map { it.id })
                    }

                    // Summary is one row keyed by sessionId → REPLACE updates it in place.
                    s.summary?.let { summaryDao.insert(it.toEntity(id)) }

                    val actions = s.actionItems.map { it.toEntity(id) }
                    if (actions.isEmpty()) actionItemDao.deleteForSession(id)
                    else {
                        actionItemDao.insertAll(actions)
                        actionItemDao.deleteStale(id, actions.map { it.id })
                    }

                    val notes = s.notes.map { it.toEntity(id) }
                    if (notes.isEmpty()) noteDao.deleteForSession(id)
                    else {
                        noteDao.insertAll(notes)
                        noteDao.deleteStale(id, notes.map { it.id })
                    }
                }
                ApiResult.Success(Unit)
            }
            is ApiResult.Failure -> result
        }

    /**
     * Create the server session + signed upload target up front (used by the capture
     * stop flow so we can navigate straight to the new session). Inserts the session +
     * local-audio link into Room immediately so it appears in the library and workspace
     * without waiting for a refresh. Returns the target for the (background) upload.
     */
    suspend fun createRecordingSession(
        filePath: String,
        mime: String,
        durationSec: Int?,
        title: String,
    ): ApiResult<UploadUrlResponseDto> {
        val file = File(filePath)
        val r = safeApiCall(json) {
            api.createUploadUrl(UploadUrlRequestDto(file.name, mime, file.length(), durationSec, "MOBILE", title))
        }
        if (r is ApiResult.Success) {
            sessionDao.upsertSession(
                SessionEntity(
                    id = r.data.sessionId,
                    title = title,
                    source = "MOBILE",
                    status = "UPLOADED",
                    language = null,
                    durationSec = durationSec,
                    createdAt = Instant.now().toString(),
                ),
            )
            localAudioDao.upsert(
                LocalAudioEntity(r.data.sessionId, filePath, mime, durationSec, file.length(), System.currentTimeMillis()),
            )
        }
        return r
    }

    /** Live capture: insert the freshly-created RECORDING session locally so it shows
     *  in the library + workspace immediately while chunks stream in. */
    suspend fun insertLiveSession(id: String, title: String) {
        sessionDao.upsertSession(
            SessionEntity(
                id = id,
                title = title,
                source = "MOBILE",
                status = "RECORDING",
                language = null,
                durationSec = null,
                createdAt = Instant.now().toString(),
            ),
        )
    }

    /** Link the on-device WAV so a live recording plays back offline. */
    suspend fun linkLocalAudio(id: String, path: String, mime: String, durationSec: Int?, sizeBytes: Long) {
        localAudioDao.upsert(LocalAudioEntity(id, path, mime, durationSec, sizeBytes, System.currentTimeMillis()))
    }

    /** Current cached status (after a refresh) — used by the upload worker's poll. */
    suspend fun statusOf(id: String): String? = sessionDao.getStatus(id)

    suspend fun clearCache() = sessionDao.clearAll()

    // --- Mutations (A5) -----------------------------------------------------

    suspend fun rename(id: String, title: String): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.updateSession(id, UpdateSessionDto(title = title)) }) {
            is ApiResult.Success -> { refreshSession(id); ApiResult.Success(Unit) }
            is ApiResult.Failure -> r
        }

    suspend fun deleteSession(id: String): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.deleteSession(id) }) {
            is ApiResult.Success -> {
                localAudioDao.get(id)?.let { audioStore.delete(it.filePath) }
                localAudioDao.delete(id)
                sessionDao.deleteSession(id)
                ApiResult.Success(Unit)
            }
            is ApiResult.Failure -> r
        }

    /** Optimistic action-item toggle with revert on failure. */
    suspend fun setActionDone(id: String, done: Boolean): ApiResult<Unit> {
        actionItemDao.setDone(id, done)
        return when (val r = safeApiCall(json) { api.updateActionItem(id, UpdateActionItemDto(done = done)) }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> { actionItemDao.setDone(id, !done); r }
        }
    }

    suspend fun addNote(sessionId: String, text: String, anchorMs: Int?): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.addNote(sessionId, AddNoteDto(text, anchorMs)) }) {
            is ApiResult.Success -> {
                val n = r.data.note
                noteDao.insertAll(listOf(NoteEntity(n.id, sessionId, n.anchorMs, n.text, n.createdAt, n.updatedAt)))
                ApiResult.Success(Unit)
            }
            is ApiResult.Failure -> r
        }

    suspend fun deleteNote(noteId: String, sessionId: String): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.deleteNote(noteId) }) {
            is ApiResult.Success -> { refreshSession(sessionId); ApiResult.Success(Unit) }
            is ApiResult.Failure -> r
        }

    suspend fun regenerateSummary(sessionId: String): ApiResult<Unit> =
        when (val r = safeApiCall(json) { api.regenerateSummary(sessionId) }) {
            is ApiResult.Success -> {
                summaryDao.deleteForSession(sessionId)
                summaryDao.insert(r.data.summary.toEntity(sessionId))
                ApiResult.Success(Unit)
            }
            is ApiResult.Failure -> r
        }

    suspend fun deleteLocalAudio(sessionId: String) {
        localAudioDao.get(sessionId)?.let { audioStore.delete(it.filePath) }
        localAudioDao.delete(sessionId)
    }

    /** Live keyword search (not cached). */
    suspend fun search(query: String): ApiResult<List<com.doppio.core.network.dto.SearchHitDto>> =
        when (val r = safeApiCall(json) { api.search(query) }) {
            is ApiResult.Success -> ApiResult.Success(r.data.hits)
            is ApiResult.Failure -> r
        }
}
