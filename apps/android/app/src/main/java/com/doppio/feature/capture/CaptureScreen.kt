package com.doppio.feature.capture

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.capture.RecorderController
import com.doppio.core.ui.theme.MonoNumerals

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
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when (ui.phase) {
                CaptureViewModel.Phase.Submitted -> SubmittedContent(onDone)

                CaptureViewModel.Phase.Recording -> RecordingContent(
                    rec = rec,
                    onStop = viewModel::stopAndUpload,
                    onPauseResume = {
                        if (rec.status == RecorderController.Status.Recording) viewModel.pause()
                        else viewModel.resume()
                    },
                    onDiscard = viewModel::discard,
                )

                else -> IdleContent(
                    errorMessage = ui.message.takeIf { ui.phase == CaptureViewModel.Phase.Error },
                    onRecord = {
                        pendingStart.value = true
                        micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    },
                    onImport = { filePicker.launch(arrayOf("audio/*")) },
                )
            }
        }
    }
}

@Composable
private fun IdleContent(errorMessage: String?, onRecord: () -> Unit, onImport: () -> Unit) {
    Text(
        "Capture a conversation",
        style = MaterialTheme.typography.headlineSmall,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(8.dp))
    Text(
        "Record live or import an audio file — Doppio transcribes and summarizes it for you.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
    )
    errorMessage?.let {
        Spacer(Modifier.height(16.dp))
        Text(it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
    }
    Spacer(Modifier.height(48.dp))
    RecordButton(onClick = onRecord)
    Spacer(Modifier.height(20.dp))
    Text("Tap to start recording", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(28.dp))
    TextButton(onClick = onImport) { Text("Import an audio file instead") }
}

@Composable
private fun RecordButton(onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = MaterialTheme.colorScheme.secondary,
        contentColor = MaterialTheme.colorScheme.onSecondary,
        modifier = Modifier.size(116.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Default.Mic, contentDescription = "Record", modifier = Modifier.size(48.dp))
        }
    }
}

@Composable
private fun RecordingContent(
    rec: RecorderController.State,
    onStop: () -> Unit,
    onPauseResume: () -> Unit,
    onDiscard: () -> Unit,
) {
    val paused = rec.status == RecorderController.Status.Paused
    Text(formatElapsed(rec.elapsedMs), style = MaterialTheme.typography.displaySmall.merge(MonoNumerals))
    Spacer(Modifier.height(6.dp))
    Text(
        if (paused) "Paused" else "Recording…",
        style = MaterialTheme.typography.bodyMedium,
        color = if (paused) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.secondary,
    )

    Spacer(Modifier.height(40.dp))

    // Amplitude-reactive ring behind the stop button.
    val ring by animateFloatAsState(targetValue = if (paused) 0f else rec.amplitude, label = "amp")
    Box(contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size((140 + ring * 56).dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.14f)),
        )
        Surface(
            onClick = onStop,
            shape = CircleShape,
            color = MaterialTheme.colorScheme.secondary,
            contentColor = MaterialTheme.colorScheme.onSecondary,
            modifier = Modifier.size(104.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Stop, contentDescription = "Stop & transcribe", modifier = Modifier.size(44.dp))
            }
        }
    }

    Spacer(Modifier.height(40.dp))
    Text("Stop & transcribe", style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(24.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onPauseResume) {
            Icon(
                if (paused) Icons.Default.PlayArrow else Icons.Default.Pause,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.size(8.dp))
            Text(if (paused) "Resume" else "Pause")
        }
        TextButton(onClick = onDiscard) { Text("Discard", color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun SubmittedContent(onDone: () -> Unit) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier.size(80.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(40.dp))
        }
    }
    Spacer(Modifier.height(24.dp))
    Text("Uploading…", style = MaterialTheme.typography.headlineSmall)
    Spacer(Modifier.height(8.dp))
    Text(
        "Transcription runs in the background — you can leave this screen and we'll notify you when it's ready.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(28.dp))
    Button(
        onClick = onDone,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
    ) { Text("Back to library") }
}

private fun formatElapsed(ms: Long): String {
    val totalSec = (ms / 1000).toInt()
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}