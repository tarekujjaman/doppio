package com.doppio.feature.capture

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.capture.RecorderController

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaptureScreen(
    onDone: () -> Unit,
    onBack: () -> Unit,
    viewModel: CaptureViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val rec by viewModel.recorderState.collectAsStateWithLifecycle()

    val pendingStart = remember { mutableStateOf(false) }

    val notifPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* best-effort; notification is optional */ }

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && pendingStart.value) {
            pendingStart.value = false
            viewModel.startRecording()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    val filePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri -> if (uri != null) viewModel.importFile(uri) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New session") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { inner ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(inner)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when (ui.phase) {
                CaptureViewModel.Phase.Submitted -> {
                    Text("Uploading…", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "Transcription runs in the background — you can leave this screen. " +
                            "We'll notify you when it's ready.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Button(onClick = onDone, modifier = Modifier.padding(top = 24.dp)) {
                        Text("Back to library")
                    }
                }

                CaptureViewModel.Phase.Recording -> {
                    val recording = rec.status == RecorderController.Status.Recording
                    Icon(
                        Icons.Default.Mic,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.error,
                    )
                    Text(
                        formatElapsed(rec.elapsedMs),
                        style = MaterialTheme.typography.displaySmall,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    LinearProgressIndicator(
                        progress = { rec.amplitude },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                    )
                    Text(
                        if (rec.status == RecorderController.Status.Paused) "Paused" else "Recording…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(
                        Modifier.padding(top = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Button(onClick = viewModel::stopAndUpload) { Text("Stop & transcribe") }
                        OutlinedButton(onClick = { if (recording) viewModel.pause() else viewModel.resume() }) {
                            Text(if (recording) "Pause" else "Resume")
                        }
                    }
                    OutlinedButton(onClick = viewModel::discard, modifier = Modifier.padding(top = 8.dp)) {
                        Text("Discard")
                    }
                }

                else -> {
                    if (ui.phase == CaptureViewModel.Phase.Error) {
                        Text(
                            ui.message ?: "Something went wrong",
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(bottom = 16.dp),
                        )
                    }
                    Button(
                        onClick = {
                            pendingStart.value = true
                            micPermission.launch(Manifest.permission.RECORD_AUDIO)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.Mic, contentDescription = null)
                        Spacer(Modifier.size(8.dp))
                        Text("Record")
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { filePicker.launch(arrayOf("audio/*")) },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Import audio file") }
                }
            }
        }
    }
}

private fun formatElapsed(ms: Long): String {
    val totalSec = (ms / 1000).toInt()
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}
