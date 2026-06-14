package com.doppio.core.data

import androidx.room.withTransaction
import com.doppio.core.data.db.DoppioDatabase
import com.doppio.core.data.db.dao.ActionItemDao
import com.doppio.core.data.db.dao.NoteDao
import com.doppio.core.data.db.dao.SessionDao
import com.doppio.core.data.db.dao.SummaryDao
import com.doppio.core.data.db.dao.TranscriptDao
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.data.db.entity.SessionWithDetail
import com.doppio.core.network.ApiResult
import com.doppio.core.network.DoppioApi
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
) {
    fun observeSessions(): Flow<List<SessionEntity>> = sessionDao.observeAll()

    fun observeSession(id: String): Flow<SessionWithDetail?> = sessionDao.observeDetail(id)

    /** Fetches a page of the list into Room; returns the next cursor (or null). */
    suspend fun refreshSessions(query: String? = null, cursor: String? = null): ApiResult<String?> =
        when (val result = safeApiCall(json) { api.listSessions(query = query, cursor = cursor) }) {
            is ApiResult.Success -> {
                sessionDao.upsertSummaries(result.data.sessions.map { it.toEntity() })
                ApiResult.Success(result.data.nextCursor)
            }
            is ApiResult.Failure -> result
        }

    /** Fetches full detail (transcript/summary/actions/notes) into Room. */
    suspend fun refreshSession(id: String): ApiResult<Unit> =
        when (val result = safeApiCall(json) { api.getSession(id) }) {
            is ApiResult.Success -> {
                val s = result.data.session
                db.withTransaction {
                    sessionDao.upsertSession(s.toEntity())
                    transcriptDao.deleteForSession(id)
                    transcriptDao.insertAll(s.transcript.map { it.toEntity(id) })
                    summaryDao.deleteForSession(id)
                    s.summary?.let { summaryDao.insert(it.toEntity(id)) }
                    actionItemDao.deleteForSession(id)
                    actionItemDao.insertAll(s.actionItems.map { it.toEntity(id) })
                    noteDao.deleteForSession(id)
                    noteDao.insertAll(s.notes.map { it.toEntity(id) })
                }
                ApiResult.Success(Unit)
            }
            is ApiResult.Failure -> result
        }

    /** Current cached status (after a refresh) — used by the upload worker's poll. */
    suspend fun statusOf(id: String): String? = sessionDao.getStatus(id)

    suspend fun clearCache() = sessionDao.clearAll()
}
