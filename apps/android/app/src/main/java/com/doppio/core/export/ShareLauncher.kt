package com.doppio.core.export

import android.content.Context
import android.content.Intent

/** Fires the system share sheet for an exported file. */
fun shareFile(context: Context, share: FileExporter.Shareable) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = share.mime
        putExtra(Intent.EXTRA_STREAM, share.uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, "Share").apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    runCatching { context.startActivity(chooser) }
}
