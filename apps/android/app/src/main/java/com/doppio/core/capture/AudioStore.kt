package com.doppio.core.capture

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * On-device store for recordings. Files live in app-private storage under
 * `recordings/` — which the backup rules exclude, so they never sync to the cloud.
 * This is the permanent local copy (the cloud copy is transient + deleted after STT).
 */
@Singleton
class AudioStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val dir: File = File(context.filesDir, "recordings").apply { mkdirs() }

    fun newRecordingFile(timestampMs: Long): File = File(dir, "rec-$timestampMs.m4a")

    fun newImportFile(timestampMs: Long, ext: String): File =
        File(dir, "import-$timestampMs.${ext.ifBlank { "m4a" }}")

    fun delete(path: String): Boolean = runCatching { File(path).delete() }.getOrDefault(false)

    fun exists(path: String): Boolean = runCatching { File(path).exists() }.getOrDefault(false)
}
