package com.doppio.feature.ask

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.export.shareFile
import com.doppio.core.network.dto.AskCitationDto
import com.doppio.core.ui.DoppioMark

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AskDoppioScreen(
    onBack: () -> Unit,
    onOpenSession: (String) -> Unit,
    viewModel: AskDoppioViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val listState = rememberLazyListState()

    LaunchedEffect(ui.share) {
        ui.share?.let { shareFile(context, it); viewModel.clearShare() }
    }
    // Keep the latest message in view as the answer streams.
    LaunchedEffect(ui.messages.size, ui.messages.lastOrNull()?.text) {
        if (ui.messages.isNotEmpty()) listState.animateScrollToItem(ui.messages.size - 1)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        DoppioMark(size = 22.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("Ask Doppio")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::exportTxt, enabled = ui.messages.isNotEmpty()) {
                        Icon(Icons.Outlined.IosShare, contentDescription = "Export as .txt")
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
            if (ui.loading) {
                Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
                return@Column
            }

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (ui.messages.isEmpty()) {
                    item {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(top = 48.dp)) {
                            DoppioMark(size = 48.dp)
                            Spacer(Modifier.width(0.dp))
                            Text(
                                "Ask anything from your whole memory",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(top = 16.dp),
                            )
                            Text(
                                "Answers draw on every session's transcript, summary, notes, and action items — and cite where they came from.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                }
                items(ui.messages) { m -> MessageBubble(m, onOpenSession) }
            }

            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = ui.input,
                    onValueChange = viewModel::onInput,
                    placeholder = { Text("Ask your memory…") },
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    enabled = !ui.asking,
                )
                IconButton(onClick = viewModel::send, enabled = !ui.asking && ui.input.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                }
            }
        }
    }
}

private val SEG_MARKER = Regex("\\[seg:\\d+\\]")

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MessageBubble(m: AskDoppioViewModel.Msg, onOpenSession: (String) -> Unit) {
    val isUser = m.role == "user"
    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
    ) {
        Surface(
            color = if (isUser) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
            contentColor = if (isUser) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            shape = RoundedCornerShape(14.dp),
        ) {
            // Hide the [seg:N] citation markers from the displayed text (they're
            // surfaced as the source chips below instead).
            val display = m.text.replace(SEG_MARKER, "").replace(Regex("[ \\t]{2,}"), " ").trim()
            Text(
                display.ifEmpty { "…" },
                Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        val cites = m.citations.filter { it.sessionId != null }.distinctBy { it.sessionId to it.startMs }
        if (cites.isNotEmpty()) {
            FlowRow(
                Modifier
                    .padding(top = 6.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                cites.take(6).forEach { c -> CitationChip(c, onOpenSession) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun CitationChip(c: AskCitationDto, onOpenSession: (String) -> Unit) {
    val time = c.startMs?.takeIf { it > 0 }?.let { "%d:%02d".format(it / 1000 / 60, it / 1000 % 60) }
    val label = buildString {
        append(c.sessionTitle?.take(24) ?: "Session")
        if (time != null) append(" · ").append(time)
    }
    AssistChip(
        onClick = { c.sessionId?.let(onOpenSession) },
        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
    )
}
