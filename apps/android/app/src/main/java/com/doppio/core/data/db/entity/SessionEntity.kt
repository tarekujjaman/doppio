package com.doppio.core.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Server-owned session fields. Device-only data (local audio) lives in a separate
 *  table (A4) so list/detail refreshes never clobber it. */
@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey val id: String,
    val title: String,
    val source: String,
    val status: String,
    val language: String?,
    val durationSec: Int?,
    val privateMode: Boolean = false,
    val hasAudio: Boolean = false,
    val audioKey: String? = null,
    val tags: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String? = null,
)
