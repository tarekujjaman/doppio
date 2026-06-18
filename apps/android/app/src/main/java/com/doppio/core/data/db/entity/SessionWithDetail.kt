package com.doppio.core.data.db.entity

import androidx.room.Embedded
import androidx.room.Relation

/** Session + its children, assembled by Room for the workspace screen. */
data class SessionWithDetail(
    @Embedded val session: SessionEntity,
    @Relation(parentColumn = "id", entityColumn = "sessionId")
    val transcript: List<TranscriptSegmentEntity> = emptyList(),
    // One-to-one modeled as a list (Room @Relation returns collections); take first.
    @Relation(parentColumn = "id", entityColumn = "sessionId")
    val summaries: List<SummaryEntity> = emptyList(),
    @Relation(parentColumn = "id", entityColumn = "sessionId")
    val actionItems: List<ActionItemEntity> = emptyList(),
    @Relation(parentColumn = "id", entityColumn = "sessionId")
    val notes: List<NoteEntity> = emptyList(),
) {
    val summary: SummaryEntity? get() = summaries.firstOrNull()
}
