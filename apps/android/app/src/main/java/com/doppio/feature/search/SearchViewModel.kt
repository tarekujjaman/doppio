package com.doppio.feature.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.doppio.core.data.SessionRepository
import com.doppio.core.network.ApiResult
import com.doppio.core.network.dto.SearchHitDto
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
class SearchViewModel @Inject constructor(
    private val repo: SessionRepository,
) : ViewModel() {

    data class UiState(
        val query: String = "",
        val hits: List<SearchHitDto> = emptyList(),
        val loading: Boolean = false,
        val message: String? = null,
        val searched: Boolean = false,
    )

    private val _ui = MutableStateFlow(UiState())
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    private var job: Job? = null

    fun onQueryChange(value: String) {
        _ui.update { it.copy(query = value) }
        job?.cancel()
        if (value.trim().length < 2) {
            _ui.update { it.copy(hits = emptyList(), searched = false, loading = false) }
            return
        }
        job = viewModelScope.launch {
            delay(300) // debounce
            _ui.update { it.copy(loading = true, message = null) }
            when (val r = repo.search(value.trim())) {
                is ApiResult.Success -> _ui.update { it.copy(loading = false, hits = r.data, searched = true) }
                is ApiResult.Failure -> _ui.update { it.copy(loading = false, message = r.message, searched = true) }
            }
        }
    }
}
