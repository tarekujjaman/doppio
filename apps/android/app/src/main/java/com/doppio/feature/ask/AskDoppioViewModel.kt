package com.doppio.feature.ask

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.export.FileExporter
import com.doppio.core.network.ApiResult
import com.doppio.core.network.AskClient
import com.doppio.core.network.AskEvent
import com.doppio.core.network.DoppioApi
import com.doppio.core.network.dto.AskCitationDto
import com.doppio.core.network.dto.AskThreadSummaryDto
import com.doppio.core.network.safeApiCall
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import javax.inject.Inject

@HiltViewModel
class AskDoppioViewModel @Inject constructor(
    private val askClient: AskClient,
    private val api: DoppioApi,
    private val json: Json,
    private val exporter: FileExporter,
) : ViewModel() {

    data class Msg(
        val role: String, // "user" | "assistant"
        val text: String,
        val citations: List<AskCitationDto> = emptyList(),
    )

    data class UiState(
        val messages: List<Msg> = emptyList(),
        val input: String = "",
        val asking: Boolean = false,
        val loading: Boolean = true,
        val threads: List<AskThreadSummaryDto> = emptyList(),
        val share: FileExporter.Shareable? = null,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private var threadId: String? = null
    private var askJob: Job? = null

    init { load(null, showLoading = true) }

    /** Load history + a conversation (null = most recent / resume). */
    private fun load(tid: String?, showLoading: Boolean) {
        if (showLoading) _ui.update { it.copy(loading = true) }
        viewModelScope.launch {
            when (val r = safeApiCall(json) { api.getAskMemory(tid) }) {
                is ApiResult.Success -> {
                    threadId = r.data.threadId
                    _ui.update {
                        it.copy(
                            loading = false,
                            threads = r.data.threads,
                            messages = r.data.messages.map { m -> Msg(m.role, m.text, m.citations) },
                        )
                    }
                }
                is ApiResult.Failure -> _ui.update { it.copy(loading = false) }
            }
        }
    }

    /** Open a past conversation from history. */
    fun openThread(id: String) = load(id, showLoading = true)

    /** Start a fresh conversation (kept separate in history). */
    fun newChat() {
        askJob?.cancel()
        threadId = null
        _ui.update { it.copy(messages = emptyList(), input = "", asking = false) }
    }

    /** Refresh just the history list (after a new chat's first answer creates a thread). */
    private fun refreshThreads() {
        viewModelScope.launch {
            (safeApiCall(json) { api.getAskMemory(threadId) } as? ApiResult.Success)?.let { r ->
                _ui.update { it.copy(threads = r.data.threads) }
            }
        }
    }

    fun onInput(value: String) = _ui.update { it.copy(input = value) }

    /** Ask a specific question (used by the suggested-prompt chips). */
    fun ask(question: String) {
        _ui.update { it.copy(input = question) }
        send()
    }

    fun send() {
        val q = _ui.value.input.trim()
        if (q.isEmpty() || _ui.value.asking) return
        _ui.update {
            it.copy(
                input = "",
                asking = true,
                messages = it.messages + Msg("user", q) + Msg("assistant", ""),
            )
        }
        askJob?.cancel()
        askJob = viewModelScope.launch {
            askClient.streamGlobal(q, threadId).collect { event ->
                when (event) {
                    is AskEvent.Meta -> threadId = event.threadId ?: threadId
                    is AskEvent.Delta -> _ui.update { st ->
                        val last = st.messages.last()
                        st.copy(messages = st.messages.dropLast(1) + last.copy(text = last.text + event.text))
                    }
                    is AskEvent.Done -> {
                        _ui.update { st ->
                            val last = st.messages.last()
                            st.copy(asking = false, messages = st.messages.dropLast(1) + last.copy(citations = event.citations))
                        }
                        refreshThreads() // a brand-new chat now has a thread → show it in history
                    }
                    is AskEvent.Error -> _ui.update { st ->
                        st.copy(asking = false, messages = st.messages.dropLast(1) + Msg("assistant", "⚠️ ${event.message}"))
                    }
                }
            }
        }
    }

    /** Build a plain-text transcript of the conversation and share it as .txt. */
    fun exportTxt() {
        if (_ui.value.messages.isEmpty()) return
        viewModelScope.launch {
            val content = buildString {
                appendLine("Ask Doppio — conversation")
                appendLine("=".repeat(28))
                appendLine()
                for (m in _ui.value.messages) {
                    appendLine(if (m.role == "user") "You:" else "Doppio:")
                    appendLine(m.text)
                    val sources = m.citations.mapNotNull { it.sessionTitle }.distinct()
                    if (sources.isNotEmpty()) appendLine("Sources: ${sources.joinToString(", ")}")
                    appendLine()
                }
            }
            val share = exporter.exportText("ask-doppio-${System.currentTimeMillis()}.txt", content)
            _ui.update { it.copy(share = share) }
        }
    }

    fun clearShare() = _ui.update { it.copy(share = null) }
}
