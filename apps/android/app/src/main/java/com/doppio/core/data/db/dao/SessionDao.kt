package com.doppio.core.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.data.db.entity.SessionWithDetail
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {

    @Query("SELECT * FROM sessions ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<SessionEntity>>

    @Transaction
    @Query("SELECT * FROM sessions WHERE id = :id")
    fun observeDetail(id: String): Flow<SessionWithDetail?>

    /** Detail refresh has every server field, so a full upsert is safe. */
    @Upsert
    suspend fun upsertSession(session: SessionEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(session: SessionEntity)

    /** Updates only list-level columns, preserving detail-only fields (hasAudio,
     *  privateMode, audioKey, updatedAt) already cached from a detail fetch. */
    @Query(
        """
        UPDATE sessions SET title = :title, source = :source, status = :status,
            language = :language, durationSec = :durationSec, tags = :tags, createdAt = :createdAt
        WHERE id = :id
        """,
    )
    suspend fun updateSummary(
        id: String,
        title: String,
        source: String,
        status: String,
        language: String?,
        durationSec: Int?,
        tags: List<String>,
        createdAt: String,
    )

    /** Merge list results without clobbering detail-only columns. */
    @Transaction
    suspend fun upsertSummaries(items: List<SessionEntity>) {
        for (s in items) {
            insertIgnore(s)
            updateSummary(s.id, s.title, s.source, s.status, s.language, s.durationSec, s.tags, s.createdAt)
        }
    }

    @Query("SELECT status FROM sessions WHERE id = :id")
    suspend fun getStatus(id: String): String?

    @Query("DELETE FROM sessions WHERE id = :id")
    suspend fun deleteSession(id: String)

    @Query("DELETE FROM sessions")
    suspend fun clearAll()
}
