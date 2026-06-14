package com.doppio.core.data.db

import android.content.Context
import androidx.room.Room
import com.doppio.core.data.db.dao.ActionItemDao
import com.doppio.core.data.db.dao.NoteDao
import com.doppio.core.data.db.dao.SessionDao
import com.doppio.core.data.db.dao.SummaryDao
import com.doppio.core.data.db.dao.TranscriptDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): DoppioDatabase =
        Room.databaseBuilder(context, DoppioDatabase::class.java, "doppio.db")
            .fallbackToDestructiveMigration() // pre-1.0 cache is disposable; real migrations later
            .build()

    @Provides fun provideSessionDao(db: DoppioDatabase): SessionDao = db.sessionDao()
    @Provides fun provideTranscriptDao(db: DoppioDatabase): TranscriptDao = db.transcriptDao()
    @Provides fun provideSummaryDao(db: DoppioDatabase): SummaryDao = db.summaryDao()
    @Provides fun provideActionItemDao(db: DoppioDatabase): ActionItemDao = db.actionItemDao()
    @Provides fun provideNoteDao(db: DoppioDatabase): NoteDao = db.noteDao()
}
