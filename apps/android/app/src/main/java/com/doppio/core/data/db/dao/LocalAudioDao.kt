package com.doppio.core.data.db.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.doppio.core.data.db.entity.LocalAudioEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface LocalAudioDao {
    @Upsert
    suspend fun upsert(audio: LocalAudioEntity)

    @Query("SELECT * FROM local_audio WHERE sessionId = :sessionId")
    fun observe(sessionId: String): Flow<LocalAudioEntity?>

    @Query("SELECT * FROM local_audio WHERE sessionId = :sessionId")
    suspend fun get(sessionId: String): LocalAudioEntity?

    @Query("DELETE FROM local_audio WHERE sessionId = :sessionId")
    suspend fun delete(sessionId: String)
}
