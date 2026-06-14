package com.doppio.core.export

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.doppio.core.network.DoppioApi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/** Downloads an authed export to app cache and returns a shareable content:// Uri. */
@Singleton
class FileExporter @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: DoppioApi,
) {
    data class Shareable(val uri: Uri, val mime: String)

    suspend fun exportMyData(): Shareable? = withContext(Dispatchers.IO) {
        runCatching {
            val file = write("doppio-data-${System.currentTimeMillis()}.json", api.exportMe())
            Shareable(uriFor(file), "application/json")
        }.getOrNull()
    }

    suspend fun exportSession(id: String, format: String): Shareable? = withContext(Dispatchers.IO) {
        runCatching {
            val pdf = format == "pdf"
            val file = write("doppio-session-$id.${if (pdf) "pdf" else "docx"}", api.exportSession(id, format))
            Shareable(
                uriFor(file),
                if (pdf) "application/pdf"
                else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        }.getOrNull()
    }

    /** Writes plain text to cache and returns a shareable .txt (Ask Doppio export). */
    suspend fun exportText(name: String, content: String): Shareable? = withContext(Dispatchers.IO) {
        runCatching {
            val dir = File(context.cacheDir, "exports").apply { mkdirs() }
            val file = File(dir, name)
            file.writeText(content)
            Shareable(uriFor(file), "text/plain")
        }.getOrNull()
    }

    private fun write(name: String, body: ResponseBody): File {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, name)
        body.byteStream().use { input -> file.outputStream().use { input.copyTo(it) } }
        return file
    }

    private fun uriFor(file: File): Uri =
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
