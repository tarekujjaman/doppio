package com.doppio.feature.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.doppio.core.capture.RecorderController
import com.doppio.core.capture.RecordingManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RecordingBarViewModel @Inject constructor(
    private val recording: RecordingManager,
) : ViewModel() {
    val state: StateFlow<RecorderController.State> = recording.state
    fun togglePause() {
        if (state.value.status == RecorderController.Status.Recording) recording.pause() else recording.resume()
    }
    fun stop() {
        viewModelScope.launch { recording.stopAndUpload() }
    }
}

/**
 * Persistent recording control shown on every screen (except the capture screen) while
 * a recording is active, so it can be paused/stopped from anywhere. Tapping the body
 * opens the full capture screen.
 */
@Composable
fun RecordingBar(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RecordingBarViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (state.status == RecorderController.Status.Idle) return

    val paused = state.status == RecorderController.Status.Paused
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        shape = RoundedCornerShape(16.dp),
        shadowElevation = 6.dp,
        modifier = modifier
            .fillMaxWidth()
            .padding(12.dp),
    ) {
        Row(
            Modifier
                .clickable(onClick = onOpen)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(10.dp)
                    .background(if (paused) MaterialTheme.colorScheme.onSurfaceVariant else Color(0xFFE5484D), CircleShape),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                if (paused) "Paused · ${fmt(state.elapsedMs)}" else "Recording · ${fmt(state.elapsedMs)}",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = viewModel::togglePause) {
                Icon(
                    if (paused) Icons.Default.PlayArrow else Icons.Default.Pause,
                    contentDescription = if (paused) "Resume" else "Pause",
                )
            }
            IconButton(onClick = viewModel::stop) {
                Icon(Icons.Default.Stop, contentDescription = "Stop & transcribe")
            }
        }
    }
}

private fun fmt(ms: Long): String {
    val s = (ms / 1000).toInt()
    return "%d:%02d".format(s / 60, s % 60)
}
