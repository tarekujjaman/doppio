package com.doppio.feature.library

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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.ui.SessionStatuses
import com.doppio.core.ui.formatDuration
import com.doppio.core.ui.shortDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    onOpenSession: (String) -> Unit,
    onNewSession: () -> Unit,
    onSignOut: () -> Unit,
    viewModel: LibraryViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val filtered = remember(ui.all, ui.query) {
        val q = ui.query.trim()
        if (q.isBlank()) ui.all else ui.all.filter { it.title.contains(q, ignoreCase = true) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Doppio") },
                actions = {
                    IconButton(onClick = onSignOut) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Sign out")
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNewSession,
                icon = { Icon(Icons.Default.Mic, contentDescription = null) },
                text = { Text("New session") },
            )
        },
    ) { inner ->
        Column(
            Modifier
                .padding(inner)
                .fillMaxSize(),
        ) {
            OutlinedTextField(
                value = ui.query,
                onValueChange = viewModel::onQueryChange,
                label = { Text("Search sessions") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { viewModel.search() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )

            PullToRefreshBox(
                isRefreshing = ui.refreshing,
                onRefresh = viewModel::refresh,
                modifier = Modifier.fillMaxSize(),
            ) {
                when {
                    ui.error != null && filtered.isEmpty() ->
                        CenteredMessage("Couldn't load sessions\n${ui.error}", onRetry = viewModel::refresh)

                    ui.loaded && filtered.isEmpty() ->
                        CenteredMessage(
                            if (ui.query.isBlank()) "No sessions yet" else "No matches for \"${ui.query}\"",
                        )

                    else -> LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(filtered, key = { it.id }) { session ->
                            SessionCard(session, onClick = { onOpenSession(session.id) })
                        }
                        if (ui.query.isBlank() && ui.nextCursor != null) {
                            item {
                                if (ui.loadingMore) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        Alignment.Center,
                                    ) { CircularProgressIndicator() }
                                } else {
                                    TextButton(
                                        onClick = viewModel::loadMore,
                                        modifier = Modifier.fillMaxWidth(),
                                    ) { Text("Load more") }
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
private fun SessionCard(session: SessionEntity, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    session.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                StatusBadge(session.status)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                buildString {
                    session.language?.let { append(it.uppercase()).append(" · ") }
                    append(formatDuration(session.durationSec)).append(" · ")
                    append(shortDate(session.createdAt))
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (session.tags.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    session.tags.joinToString(" ") { "#$it" },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
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
    Surface(color = container, shape = RoundedCornerShape(50)) {
        Text(
            SessionStatuses.label(status),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            color = content,
            style = MaterialTheme.typography.labelSmall,
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
        Text(message, style = MaterialTheme.typography.bodyMedium)
        if (onRetry != null) {
            TextButton(onClick = onRetry, modifier = Modifier.padding(top = 8.dp)) { Text("Retry") }
        }
    }
}
