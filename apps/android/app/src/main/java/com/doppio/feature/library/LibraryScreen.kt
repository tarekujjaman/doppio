package com.doppio.feature.library

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.capture.RecorderController
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.ui.DoppioLockup
import com.doppio.core.ui.DoppioMark
import com.doppio.core.ui.SessionStatuses
import com.doppio.core.ui.formatDuration
import com.doppio.core.ui.shortDate
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    onOpenSession: (String) -> Unit,
    onNewSession: () -> Unit,
    onSearch: () -> Unit,
    onBilling: () -> Unit,
    onSettings: () -> Unit,
    onSignOut: () -> Unit,
    viewModel: LibraryViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val rec by viewModel.recording.collectAsStateWithLifecycle()
    val isRecording = rec.status != RecorderController.Status.Idle
    var menuOpen by remember { mutableStateOf(false) }
    val filtered = remember(ui.all, ui.query) {
        val q = ui.query.trim()
        if (q.isBlank()) ui.all else ui.all.filter { it.title.contains(q, ignoreCase = true) }
    }
    val totalSec = remember(ui.all) { ui.all.sumOf { it.durationSec ?: 0 } }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { DoppioLockup(markSize = 24.dp, style = MaterialTheme.typography.titleLarge) },
                actions = {
                    IconButton(onClick = onSearch) {
                        Icon(Icons.Default.Search, contentDescription = "Search content")
                    }
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menu")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Plan & usage") }, onClick = { menuOpen = false; onBilling() })
                        DropdownMenuItem(text = { Text("Settings") }, onClick = { menuOpen = false; onSettings() })
                        DropdownMenuItem(text = { Text("Sign out") }, onClick = { menuOpen = false; onSignOut() })
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        floatingActionButton = {
            // Hidden while recording — the global recording bar owns the controls then.
            if (!isRecording) {
                ExtendedFloatingActionButton(
                    onClick = onNewSession,
                    icon = { Icon(Icons.Default.Mic, contentDescription = null) },
                    text = { Text("New session") },
                    containerColor = MaterialTheme.colorScheme.secondary,
                    contentColor = MaterialTheme.colorScheme.onSecondary,
                )
            }
        },
    ) { inner ->
        PullToRefreshBox(
            isRefreshing = ui.refreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier
                .padding(inner)
                .fillMaxSize(),
        ) {
            when {
                ui.error != null && filtered.isEmpty() ->
                    CenteredMessage("Couldn't load sessions\n${ui.error}", onRetry = viewModel::refresh)

                ui.loaded && ui.all.isEmpty() ->
                    EmptyState(searching = false, query = "")

                else -> LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 100.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    item {
                        DashboardHeader(count = ui.all.size, totalSec = totalSec)
                    }
                    item {
                        OutlinedTextField(
                            value = ui.query,
                            onValueChange = viewModel::onQueryChange,
                            placeholder = { Text("Search your sessions") },
                            singleLine = true,
                            shape = MaterialTheme.shapes.large,
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = { viewModel.search() }),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    item {
                        Text(
                            if (ui.query.isBlank()) "Recent sessions" else "Results",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp, start = 4.dp),
                        )
                    }
                    if (filtered.isEmpty()) {
                        item {
                            Text(
                                "No matches for \"${ui.query}\"",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                    }
                    items(filtered, key = { it.id }) { session ->
                        SessionCard(session, onClick = { onOpenSession(session.id) })
                    }
                    if (ui.query.isBlank() && ui.nextCursor != null) {
                        item {
                            if (ui.loadingMore) {
                                Box(Modifier.fillMaxWidth().padding(16.dp), Alignment.Center) {
                                    CircularProgressIndicator()
                                }
                            } else {
                                TextButton(onClick = viewModel::loadMore, modifier = Modifier.fillMaxWidth()) {
                                    Text("Load more")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardHeader(count: Int, totalSec: Int) {
    val greeting = remember {
        when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
            in 0..11 -> "Good morning"
            in 12..16 -> "Good afternoon"
            else -> "Good evening"
        }
    }
    Column(Modifier.padding(top = 4.dp, bottom = 4.dp)) {
        Text(greeting, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(2.dp))
        Text(
            "Your conversations, distilled",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(Modifier.weight(1f), Icons.Outlined.Description, count.toString(), "Sessions")
            StatCard(Modifier.weight(1f), Icons.Default.GraphicEq, formatTotal(totalSec), "Recorded")
        }
    }
}

@Composable
private fun StatCard(modifier: Modifier, icon: ImageVector, value: String, label: String) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
    ) {
        Column(Modifier.padding(16.dp)) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.height(10.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun formatTotal(totalSec: Int): String {
    if (totalSec <= 0) return "—"
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    return when {
        h > 0 -> "${h}h ${m}m"
        m > 0 -> "${m}m"
        else -> "${totalSec}s"
    }
}

@Composable
private fun SessionCard(session: SessionEntity, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    session.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(10.dp))
                StatusBadge(session.status)
            }
            Spacer(Modifier.height(8.dp))
            Text(
                buildString {
                    session.language?.let { append(it.uppercase()).append("  ·  ") }
                    append(formatDuration(session.durationSec)).append("  ·  ")
                    append(shortDate(session.createdAt))
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (session.tags.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    session.tags.take(3).forEach { tag -> TagChip(tag) }
                }
            }
        }
    }
}

@Composable
private fun TagChip(tag: String) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            "#$tag",
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (container, content) = when {
        SessionStatuses.isReady(status) ->
            MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        SessionStatuses.isFailed(status) ->
            MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        else ->
            MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
    }
    Surface(color = container, contentColor = content, shape = RoundedCornerShape(50)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
        ) {
            Box(
                Modifier
                    .size(6.dp)
                    .background(content.copy(alpha = 0.7f), CircleShape),
            )
            Spacer(Modifier.width(6.dp))
            Text(SessionStatuses.label(status), style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun EmptyState(searching: Boolean, query: String) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        DoppioMark(size = 56.dp)
        Spacer(Modifier.height(20.dp))
        Text(
            if (searching) "No matches for \"$query\"" else "No sessions yet",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (searching) "Try a different word."
            else "Tap New session to record or import audio — Doppio transcribes and summarizes it for you.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun CenteredMessage(message: String, onRetry: (() -> Unit)? = null) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        if (onRetry != null) {
            TextButton(onClick = onRetry, modifier = Modifier.padding(top = 8.dp)) { Text("Retry") }
        }
    }
}
