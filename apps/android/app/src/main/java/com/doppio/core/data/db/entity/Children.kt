package com.doppio.core.data.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

private const val SESSION_FK = "sessionId"

@Entity(
    tableName = "transcript_segments",
    foreignKeys = [ForeignKey(
        entity = SessionEntity::class,
        parentColumns = ["id"],
        childColumns = [SESSION_FK],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index(SESSION_FK)],
)
data class TranscriptSegmentEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val idx: Int,
    val startMs: Int,
    val endMs: Int,
    val text: String,
    val speaker: String? = null,
)

@Entity(
    tableName = "summaries",
    foreignKeys = [ForeignKey(
        entity = SessionEntity::class,
        parentColumns = ["id"],
        childColumns = [SESSION_FK],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index(value = [SESSION_FK], unique = true)],
)
data class SummaryEntity(
    @PrimaryKey val sessionId: String,
    val overview: String,
    val detail: String? = null,
    val decisions: String? = null,
    val nextSteps: String? = null,
    val language: String = "en",
)

@Entity(
    tableName = "action_items",
    foreignKeys = [ForeignKey(
        entity = SessionEntity::class,
        parentColumns = ["id"],
        childColumns = [SESSION_FK],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index(SESSION_FK)],
)
data class ActionItemEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val text: String,
    val owner: String? = null,
    val dueHint: String? = null,
    val done: Boolean = false,
)

@Entity(
    tableName = "notes",
    foreignKeys = [ForeignKey(
        entity = SessionEntity::class,
        parentColumns = ["id"],
        childColumns = [SESSION_FK],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index(SESSION_FK)],
)
data class NoteEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val anchorMs: Int? = null,
    val text: String,
    val createdAt: String,
    val updatedAt: String? = null,
)
