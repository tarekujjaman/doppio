package com.doppio.feature.ask

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.doppio.core.export.shareFile
import com.doppio.core.network.dto.AskCitationDto
import com.doppio.core.ui.DoppioMark
import kotlinx.coroutines.delay

private val SEG_MARKER = Regex("\\[seg:\\d+\\]")

private val THINKING_PHRASES = listOf(
    "Doppio is thinking",
    "Doppio is digging through your memory",
    "Doppio is connecting the dots",
    "Doppio is re-reading your sessions",
    "Doppio is illustrating",
    "Doppio is recalling the details",
)

private val SUGGESTIONS = listOf(
    "Summarize my recent sessions",
    "What are my open action items?",
    "What did I decide this week?",
    "What should I follow up on?",
)

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
    LaunchedEffect(ui.messages.size, ui.messages.lastOrNull()?.text) {
        if (ui.messages.isNotEmpty()) listState.animateScrollToItem(ui.messages.size - 1)
    }

    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Text(
                    "Your chats",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(16.dp),
                )
                NavigationDrawerItem(
                    label = { Text("New chat") },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    selected = false,
                    onClick = { viewModel.newChat(); scope.launch { drawerState.close() } },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                LazyColumn {
                    items(ui.threads) { t ->
                        NavigationDrawerItem(
                            label = { Text(t.title, maxLines = 1) },
                            selected = false,
                            onClick = { viewModel.openThread(t.id); scope.launch { drawerState.close() } },
                            modifier = Modifier.padding(horizontal = 12.dp),
                        )
                    }
                }
            }
        },
    ) {
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
                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                        Icon(Icons.Default.History, contentDescription = "Chat history")
                    }
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
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (ui.messages.isEmpty()) {
                    item { EmptyHero(onPick = viewModel::ask) }
                }
                itemsIndexed(ui.messages) { index, m ->
                    val thinking = ui.asking && index == ui.messages.lastIndex &&
                        m.role == "assistant" && m.text.isBlank()
                    val streaming = ui.asking && index == ui.messages.lastIndex && m.role == "assistant"
                    MessageBubble(
                        m = m,
                        thinking = thinking,
                        streaming = streaming && !thinking,
                        onOpenSession = onOpenSession,
                        modifier = Modifier.animateItem(),
                    )
                }
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
                Spacer(Modifier.width(6.dp))
                Surface(
                    onClick = viewModel::send,
                    enabled = !ui.asking && ui.input.isNotBlank(),
                    shape = RoundedCornerShape(50),
                    color = MaterialTheme.colorScheme.secondary,
                    contentColor = MaterialTheme.colorScheme.onSecondary,
                    modifier = Modifier.size(48.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                    }
                }
            }
        }
    }
    }
}

@Composable
private fun EmptyHero(onPick: (String) -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        DoppioMark(size = 52.dp)
        Spacer(Modifier.size(16.dp))
        Text(
            "Ask anything from your whole memory",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(6.dp))
        Text(
            "Every session's transcript, summary, notes, and action items — and answers cite where they came from.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(24.dp))
        SUGGESTIONS.forEach { s ->
            SuggestionChip(
                onClick = { onPick(s) },
                label = { Text(s) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
            )
        }
    }
}

@Composable
private fun MessageBubble(
    m: AskDoppioViewModel.Msg,
    thinking: Boolean,
    streaming: Boolean,
    onOpenSession: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val isUser = m.role == "user"
    Row(
        modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Top,
    ) {
        if (!isUser) {
            DoppioMark(size = 26.dp, modifier = Modifier.padding(top = 4.dp, end = 8.dp))
        }
        Column(horizontalAlignment = if (isUser) Alignment.End else Alignment.Start) {
            Surface(
                color = if (isUser) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.surfaceVariant,
                contentColor = if (isUser) MaterialTheme.colorScheme.onSecondary else MaterialTheme.colorScheme.onSurfaceVariant,
                shape = RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 4.dp,
                    bottomEnd = if (isUser) 4.dp else 16.dp,
                ),
            ) {
                if (thinking) {
                    ThinkingIndicator(Modifier.padding(12.dp))
                } else {
                    val clean = m.text.replace(SEG_MARKER, "").replace(Regex("[ \\t]{2,}"), " ").trim()
                    Text(
                        if (streaming) "$clean▌" else clean,
                        Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            CitationRow(m.citations, onOpenSession)
        }
    }
}

@Composable
private fun CitationRow(citations: List<AskCitationDto>, onOpenSession: (String) -> Unit) {
    val cites = citations.filter { it.sessionId != null }.distinctBy { it.sessionId to it.startMs }
    if (cites.isEmpty()) return
    Row(
        Modifier.padding(top = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        cites.take(4).forEach { c ->
            val time = c.startMs?.takeIf { it > 0 }?.let { "%d:%02d".format(it / 1000 / 60, it / 1000 % 60) }
            val label = (c.sessionTitle?.take(22) ?: "Session") + (time?.let { " · $it" } ?: "")
            AssistChip(
                onClick = { c.sessionId?.let(onOpenSession) },
                label = { Text(label, style = MaterialTheme.typography.labelSmall) },
            )
        }
    }
}

@Composable
private fun ThinkingIndicator(modifier: Modifier = Modifier) {
    var idx by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1900)
            idx = (idx + 1) % THINKING_PHRASES.size
        }
    }
    val transition = rememberInfiniteTransition(label = "dots")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 3f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart),
        label = "phase",
    )
    val pulse by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(700, easing = LinearEasing), RepeatMode.Reverse),
        label = "pulse",
    )
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        AnimatedContent(
            targetState = idx,
            label = "phrase",
            transitionSpec = {
                (fadeIn(tween(250)) + slideInVertically { it / 2 }) togetherWith fadeOut(tween(200))
            },
        ) { i ->
            Text(
                THINKING_PHRASES[i],
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.alpha(pulse),
            )
        }
        Text(
            ".".repeat((phase.toInt() % 3) + 1),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(18.dp),
        )
    }
}
