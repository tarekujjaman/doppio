package com.doppio.core.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.doppio.core.data.db.dao.ActionItemDao
import com.doppio.core.data.db.dao.LocalAudioDao
import com.doppio.core.data.db.dao.NoteDao
import com.doppio.core.data.db.dao.SessionDao
import com.doppio.core.data.db.dao.SummaryDao
import com.doppio.core.data.db.dao.TranscriptDao
import com.doppio.core.data.db.entity.ActionItemEntity
import com.doppio.core.data.db.entity.LocalAudioEntity
import com.doppio.core.data.db.entity.NoteEntity
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.data.db.entity.SummaryEntity
import com.doppio.core.data.db.entity.TranscriptSegmentEntity

@Database(
    entities = [
        SessionEntity::class,
        TranscriptSegmentEntity::class,
        SummaryEntity::class,
        ActionItemEntity::class,
        NoteEntity::class,
        LocalAudioEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
@TypeConverters(Converters::class)
abstract class DoppioDatabase : RoomDatabase() {
    abstract fun sessionDao(): SessionDao
    abstract fun transcriptDao(): TranscriptDao
    abstract fun summaryDao(): SummaryDao
    abstract fun actionItemDao(): ActionItemDao
    abstract fun noteDao(): NoteDao
    abstract fun localAudioDao(): LocalAudioDao
}
