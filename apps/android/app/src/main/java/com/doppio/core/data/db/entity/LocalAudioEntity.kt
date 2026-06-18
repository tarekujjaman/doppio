package com.doppio.core.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Maps a session to its on-device recording. Independent of [SessionEntity] (no FK)
 *  so it survives server refreshes and the post-transcription audioKey=null; this is
 *  the permanent local copy that powers offline playback. */
@Entity(tableName = "local_audio")
data class LocalAudioEntity(
    @PrimaryKey val sessionId: String,
    val filePath: String,
    val mimeType: String,
    val durationSec: Int?,
    val sizeBytes: Long,
    val createdAt: Long,
)
