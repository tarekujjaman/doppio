package com.doppio.feature.workspace

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.data.db.entity.ActionItemEntity
import com.doppio.core.data.db.entity.NoteEntity
import com.doppio.core.data.db.entity.SessionWithDetail
import com.doppio.core.data.db.entity.SummaryEntity
import com.doppio.core.data.db.entity.TranscriptSegmentEntity
import com.doppio.core.ui.SessionStatuses

private val TABS = listOf("Summary", "Transcript", "Actions", "Notes")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkspaceScreen(
    onBack: () -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val detail = ui.detail
    var tab by rememberSaveable { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(detail?.session?.title ?: "Session", maxLines = 1) },
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
                .padding(inner)
                .fillMaxSize(),
        ) {
            val status = detail?.session?.status
            if (status != null && !SessionStatuses.isReady(status)) {
                StatusBanner(status, ui.error, onRetry = viewModel::refresh)
            }

            if (detail == null) {
                Box(Modifier.fillMaxSize()) {
                    if (ui.refreshing) {
                        CircularProgressIndicator(Modifier.align(Alignment.Center))
                    } else {
                        Text(
                            ui.error ?: "Loading…",
                            Modifier.align(Alignment.Center),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                return@Column
            }

            TabRow(selectedTabIndex = tab) {
                TABS.forEachIndexed { i, label ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(label) })
                }
            }

            when (tab) {
                0 -> SummaryTab(detail.summary, status)
                1 -> TranscriptTab(detail.transcript)
                2 -> ActionsTab(detail.actionItems)
                else -> NotesTab(detail.notes)
            }
        }
    }
}

@Composable
private fun StatusBanner(status: String, error: String?, onRetry: () -> Unit) {
    val failed = SessionStatuses.isFailed(status)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (!failed) {
            CircularProgressIndicator(Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        }
        Text(
            if (failed) (error ?: "Processing failed") else SessionStatuses.label(status),
            style = MaterialTheme.typography.bodyMedium,
            color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        if (failed) TextButton(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
private fun SummaryTab(summary: SummaryEntity?, status: String?) {
    if (summary == null) {
        EmptyTab(
            if (status != null && SessionStatuses.isInFlight(status)) "Summary is being generated…"
            else "No summary yet.",
        )
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item { Section("Overview", summary.overview) }
        summary.decisions?.takeIf { it.isNotBlank() }?.let { item { Section("Decisions", it) } }
        summary.nextSteps?.takeIf { it.isNotBlank() }?.let { item { Section("Next steps", it) } }
    }
}

@Composable
private fun Section(title: String, body: String) {
    Column {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun TranscriptTab(segments: List<TranscriptSegmentEntity>) {
    if (segments.isEmpty()) {
        EmptyTab("No transcript yet.")
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(segments, key = { it.id }) { seg ->
            Column {
                Text(
                    buildString {
                        append(formatMs(seg.startMs))
                        seg.speaker?.let { append("  ·  ").append(it) }
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(2.dp))
                Text(seg.text, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun ActionsTab(items: List<ActionItemEntity>) {
    if (items.isEmpty()) {
        EmptyTab("No action items.")
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(vertical = 8.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(items, key = { it.id }) { item ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Read-only in A3; toggling lands in A5.
                Checkbox(checked = item.done, onCheckedChange = null)
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(item.text, style = MaterialTheme.typography.bodyMedium)
                    val meta = listOfNotNull(item.owner, item.dueHint).joinToString(" · ")
                    if (meta.isNotBlank()) {
                        Text(
                            meta,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            HorizontalDivider()
        }
    }
}

@Composable
private fun NotesTab(notes: List<NoteEntity>) {
    if (notes.isEmpty()) {
        EmptyTab("No notes.")
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(notes, key = { it.id }) { note ->
            Column {
                note.anchorMs?.let {
                    Text(
                        formatMs(it),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Text(note.text, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun EmptyTab(message: String) {
    Box(
        Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(message, style = MaterialTheme.typography.bodyMedium)
    }
}

private fun formatMs(ms: Int): String {
    val totalSec = ms / 1000
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}
