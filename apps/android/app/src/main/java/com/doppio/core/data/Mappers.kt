package com.doppio.core.data

import com.doppio.core.data.db.entity.ActionItemEntity
import com.doppio.core.data.db.entity.NoteEntity
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.data.db.entity.SummaryEntity
import com.doppio.core.data.db.entity.TranscriptSegmentEntity
import com.doppio.core.network.dto.ActionItemDto
import com.doppio.core.network.dto.NoteDto
import com.doppio.core.network.dto.SessionDto
import com.doppio.core.network.dto.SessionSummaryDto
import com.doppio.core.network.dto.SummaryDto
import com.doppio.core.network.dto.TranscriptSegmentDto

/** List item → entity (detail-only columns left at defaults; merged via updateSummary). */
fun SessionSummaryDto.toEntity() = SessionEntity(
    id = id,
    title = title,
    source = source,
    status = status,
    language = language,
    durationSec = durationSec,
    tags = tags,
    createdAt = createdAt,
)

fun SessionDto.toEntity() = SessionEntity(
    id = id,
    title = title,
    source = source,
    status = status,
    language = language,
    durationSec = durationSec,
    privateMode = privateMode,
    hasAudio = hasAudio,
    audioKey = audioKey,
    tags = tags,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun TranscriptSegmentDto.toEntity(sessionId: String) = TranscriptSegmentEntity(
    id = id,
    sessionId = sessionId,
    idx = idx,
    startMs = startMs,
    endMs = endMs,
    text = text,
    speaker = speaker,
)

fun SummaryDto.toEntity(sessionId: String) = SummaryEntity(
    sessionId = sessionId,
    overview = overview,
    decisions = decisions,
    nextSteps = nextSteps,
    language = language,
)

fun ActionItemDto.toEntity(sessionId: String) = ActionItemEntity(
    id = id,
    sessionId = sessionId,
    text = text,
    owner = owner,
    dueHint = dueHint,
    done = done,
)

fun NoteDto.toEntity(sessionId: String) = NoteEntity(
    id = id,
    sessionId = sessionId,
    anchorMs = anchorMs,
    text = text,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
