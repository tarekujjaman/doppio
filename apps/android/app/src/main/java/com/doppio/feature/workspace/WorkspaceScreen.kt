package com.doppio.feature.workspace

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.data.db.entity.ActionItemEntity
import com.doppio.core.data.db.entity.NoteEntity
import com.doppio.core.data.db.entity.SummaryEntity
import com.doppio.core.data.db.entity.TranscriptSegmentEntity
import com.doppio.core.ui.SessionStatuses

private val TABS = listOf("Summary", "Transcript", "Actions", "Notes", "Ask")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkspaceScreen(
    onBack: () -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val player by viewModel.player.collectAsStateWithLifecycle()
    val ask by viewModel.ask.collectAsStateWithLifecycle()
    val detail = ui.detail
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var menuOpen by remember { mutableStateOf(false) }
    var showRename by remember { mutableStateOf(false) }
    var showDelete by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }

    androidx.compose.runtime.LaunchedEffect(ui.deleted) { if (ui.deleted) onBack() }
    androidx.compose.runtime.LaunchedEffect(ui.message) {
        ui.message?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text(detail?.session?.title ?: "Session", maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Rename") }, onClick = { menuOpen = false; showRename = true })
                        DropdownMenuItem(
                            text = { Text("Regenerate summary") },
                            onClick = { menuOpen = false; viewModel.regenerate() },
                        )
                        if (ui.localAudioPath != null) {
                            DropdownMenuItem(
                                text = { Text("Delete local audio") },
                                onClick = { menuOpen = false; viewModel.deleteLocalAudio() },
                            )
                        }
                        DropdownMenuItem(text = { Text("Delete session") }, onClick = { menuOpen = false; showDelete = true })
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
                StatusBanner(status, ui.message, onRetry = viewModel::refresh)
            }

            if (detail == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    if (ui.refreshing) CircularProgressIndicator() else Text(ui.message ?: "Loading…")
                }
                return@Column
            }

            if (player.available) {
                PlayerBar(player, onPlayPause = viewModel::playPause, onSeek = viewModel::seekTo)
            }

            TabRow(selectedTabIndex = tab) {
                TABS.forEachIndexed { i, label ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(label) })
                }
            }

            when (tab) {
                0 -> SummaryTab(detail.summary, status, ui.busy, onRegenerate = viewModel::regenerate)
                1 -> TranscriptTab(
                    detail.transcript,
                    positionMs = player.positionMs,
                    seekEnabled = player.available,
                    onSeek = viewModel::seekTo,
                )
                2 -> ActionsTab(detail.actionItems, onToggle = viewModel::toggleAction)
                3 -> NotesTab(detail.notes, onAdd = viewModel::addNote, onDelete = viewModel::deleteNote)
                else -> AskTab(
                    ask,
                    onInput = viewModel::onAskInput,
                    onSend = viewModel::sendQuestion,
                    onCitation = { ms -> viewModel.seekTo(ms.toLong()); tab = 1 },
                )
            }
        }
    }

    if (showRename) {
        RenameDialog(
            current = detail?.session?.title.orEmpty(),
            onConfirm = { viewModel.rename(it); showRename = false },
            onDismiss = { showRename = false },
        )
    }
    if (showDelete) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            title = { Text("Delete session?") },
            text = { Text("This removes the session and its transcript everywhere. Can't be undone.") },
            confirmButton = { TextButton(onClick = { showDelete = false; viewModel.deleteSession() }) { Text("Delete") } },
            dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun PlayerBar(state: WorkspaceViewModel.PlayerState, onPlayPause: () -> Unit, onSeek: (Long) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onPlayPause) {
            Icon(
                if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = if (state.isPlaying) "Pause" else "Play",
            )
        }
        Slider(
            value = state.positionMs.toFloat(),
            onValueChange = { onSeek(it.toLong()) },
            valueRange = 0f..(state.durationMs.toFloat().coerceAtLeast(1f)),
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Text(formatMs(state.positionMs.toInt()), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun RenameDialog(current: String, onConfirm: (String) -> Unit, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf(current) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rename session") },
        text = {
            OutlinedTextField(value = text, onValueChange = { text = it }, singleLine = true)
        },
        confirmButton = {
            TextButton(onClick = { if (text.isNotBlank()) onConfirm(text) }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
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
            CircularProgressIndicator(
                Modifier
                    .height(18.dp)
                    .width(18.dp),
                strokeWidth = 2.dp,
            )
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
private fun SummaryTab(summary: SummaryEntity?, status: String?, busy: Boolean, onRegenerate: () -> Unit) {
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
        item {
            OutlinedButton(onClick = onRegenerate, enabled = !busy) { Text("Regenerate summary") }
        }
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
private fun TranscriptTab(
    segments: List<TranscriptSegmentEntity>,
    positionMs: Long,
    seekEnabled: Boolean,
    onSeek: (Long) -> Unit,
) {
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
            val active = seekEnabled && positionMs >= seg.startMs && positionMs < seg.endMs
            Column(
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = seekEnabled) { onSeek(seg.startMs.toLong()) }
                    .background(
                        if (active) MaterialTheme.colorScheme.primaryContainer else androidx.compose.ui.graphics.Color.Transparent,
                        RoundedCornerShape(6.dp),
                    )
                    .padding(6.dp),
            ) {
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
private fun ActionsTab(items: List<ActionItemEntity>, onToggle: (String, Boolean) -> Unit) {
    if (items.isEmpty()) {
        EmptyTab("No action items.")
        return
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
        items(items, key = { it.id }) { item ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(checked = item.done, onCheckedChange = { onToggle(item.id, it) })
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(item.text, style = MaterialTheme.typography.bodyMedium)
                    val meta = listOfNotNull(item.owner, item.dueHint).joinToString(" · ")
                    if (meta.isNotBlank()) {
                        Text(meta, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            HorizontalDivider()
        }
    }
}

@Composable
private fun NotesTab(notes: List<NoteEntity>, onAdd: (String) -> Unit, onDelete: (String) -> Unit) {
    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (notes.isEmpty()) {
                item { Text("No notes yet — add one below.", style = MaterialTheme.typography.bodyMedium) }
            }
            items(notes, key = { it.id }) { note ->
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        note.anchorMs?.let {
                            Text(formatMs(it), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        }
                        Text(note.text, style = MaterialTheme.typography.bodyMedium)
                    }
                    IconButton(onClick = { onDelete(note.id) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete note")
                    }
                }
            }
        }
        AddNoteRow(onAdd)
    }
}

@Composable
private fun AddNoteRow(onAdd: (String) -> Unit) {
    var text by remember { mutableStateOf("") }
    Row(
        Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            placeholder = { Text("Add a note") },
            modifier = Modifier.weight(1f),
            singleLine = true,
        )
        IconButton(onClick = {
            if (text.isNotBlank()) {
                onAdd(text)
                text = ""
            }
        }) {
            Icon(Icons.Default.Send, contentDescription = "Add note")
        }
    }
}

@Composable
private fun AskTab(
    state: WorkspaceViewModel.AskState,
    onInput: (String) -> Unit,
    onSend: () -> Unit,
    onCitation: (Int) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (state.messages.isEmpty()) {
                item {
                    Text(
                        "Ask anything about this session — answers cite the transcript.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(state.messages) { m ->
                val isUser = m.role == "user"
                Column(
                    Modifier.fillMaxWidth(),
                    horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
                ) {
                    Surface(
                        color = if (isUser) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            m.text.ifEmpty { "…" },
                            Modifier.padding(10.dp),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    val cites = m.citations.filter { it.startMs != null }
                    if (cites.isNotEmpty()) {
                        Row(
                            Modifier.padding(top = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            cites.take(5).forEach { c ->
                                AssistChip(
                                    onClick = { onCitation(c.startMs!!) },
                                    label = { Text(formatMs(c.startMs!!)) },
                                )
                            }
                        }
                    }
                }
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = state.input,
                onValueChange = onInput,
                placeholder = { Text("Ask a question") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                enabled = !state.asking,
            )
            IconButton(onClick = onSend, enabled = !state.asking && state.input.isNotBlank()) {
                Icon(Icons.Default.Send, contentDescription = "Send")
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
    ) { Text(message, style = MaterialTheme.typography.bodyMedium) }
}

private fun formatMs(ms: Int): String {
    val totalSec = ms / 1000
    return "%d:%02d".format(totalSec / 60, totalSec % 60)
}
