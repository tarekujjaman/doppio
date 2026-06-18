package com.doppio.feature.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.data.SessionRepository
import com.doppio.core.data.db.entity.SessionEntity
import com.doppio.core.network.ApiResult
import com.doppio.core.ui.SessionStatuses
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val repo: SessionRepository,
) : ViewModel() {

    data class UiState(
        val all: List<SessionEntity> = emptyList(),
        val query: String = "",
        val refreshing: Boolean = false,
        val loadingMore: Boolean = false,
        val nextCursor: String? = null,
        val error: String? = null,
        val loaded: Boolean = false,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            repo.observeSessions().collect { list ->
                _ui.update { it.copy(all = list, loaded = true) }
                ensurePolling()
            }
        }
        refresh()
    }

    fun onQueryChange(value: String) = _ui.update { it.copy(query = value) }

    /** Server-side search by title (cached list filters client-side immediately). */
    fun search() = refresh()

    fun refresh() {
        _ui.update { it.copy(refreshing = true, error = null) }
        viewModelScope.launch {
            when (val r = repo.refreshSessions(query = currentQuery())) {
                is ApiResult.Success -> _ui.update { it.copy(refreshing = false, nextCursor = r.data) }
                is ApiResult.Failure -> _ui.update { it.copy(refreshing = false, error = r.message) }
            }
        }
    }

    fun loadMore() {
        val cursor = _ui.value.nextCursor ?: return
        if (_ui.value.loadingMore) return
        _ui.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            when (val r = repo.refreshSessions(query = currentQuery(), cursor = cursor)) {
                is ApiResult.Success -> _ui.update { it.copy(loadingMore = false, nextCursor = r.data) }
                is ApiResult.Failure -> _ui.update { it.copy(loadingMore = false, error = r.message) }
            }
        }
    }

    private fun currentQuery(): String? = _ui.value.query.trim().ifBlank { null }

    /** Poll while any session is mid-pipeline so it flips to READY without a manual refresh. */
    private fun ensurePolling() {
        val hasInFlight = _ui.value.all.any { SessionStatuses.isInFlight(it.status) }
        if (hasInFlight && pollJob?.isActive != true) {
            pollJob = viewModelScope.launch {
                while (_ui.value.all.any { SessionStatuses.isInFlight(it.status) }) {
                    delay(POLL_MS)
                    repo.refreshSessions(query = currentQuery())
                }
            }
        }
    }

    private companion object {
        const val POLL_MS = 3_000L
    }
}
