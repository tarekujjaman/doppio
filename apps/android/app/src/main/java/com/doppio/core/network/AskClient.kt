package com.doppio.core.network

import com.doppio.BuildConfig
import com.doppio.core.network.dto.AskCitationDto
import com.doppio.core.network.dto.AskDeltaDto
import com.doppio.core.network.dto.AskDoneDto
import com.doppio.core.network.dto.AskErrorDto
import com.doppio.core.network.dto.AskMetaDto
import com.doppio.core.network.dto.AskRequestDto
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import javax.inject.Inject
import javax.inject.Singleton

sealed interface AskEvent {
    data class Meta(val threadId: String?) : AskEvent
    data class Delta(val text: String) : AskEvent
    data class Done(val citations: List<AskCitationDto>) : AskEvent
    data class Error(val message: String) : AskEvent
}

/** Streams the single-session RAG answer over SSE (Bearer attached by the shared OkHttp client). */
@Singleton
class AskClient @Inject constructor(
    private val client: OkHttpClient,
    private val json: Json,
) {
    /** Per-session RAG answer. */
    fun stream(sessionId: String, question: String, threadId: String?): Flow<AskEvent> =
        streamSse("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/sessions/$sessionId/ask", question, threadId)

    /** Global "Ask Doppio" answer over the user's whole memory. */
    fun streamGlobal(question: String, threadId: String?): Flow<AskEvent> =
        streamSse("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/ask", question, threadId)

    private fun streamSse(url: String, question: String, threadId: String?): Flow<AskEvent> = callbackFlow {
        val payload = json.encodeToString(AskRequestDto.serializer(), AskRequestDto(question, threadId))
        val request = Request.Builder()
            .url(url)
            .addHeader("Accept", "text/event-stream")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                runCatching {
                    when (type) {
                        "meta" -> trySend(AskEvent.Meta(json.decodeFromString<AskMetaDto>(data).threadId))
                        "delta" -> trySend(AskEvent.Delta(json.decodeFromString<AskDeltaDto>(data).text))
                        "done" -> {
                            trySend(AskEvent.Done(json.decodeFromString<AskDoneDto>(data).citations))
                            close()
                        }
                        "error" -> {
                            trySend(AskEvent.Error(json.decodeFromString<AskErrorDto>(data).message))
                            close()
                        }
                    }
                }
            }

            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                val msg = when (response?.code) {
                    402 -> "Daily Ask limit reached — upgrade for more"
                    else -> t?.message ?: "Ask failed${response?.code?.let { " ($it)" } ?: ""}"
                }
                trySend(AskEvent.Error(msg))
                close()
            }

            override fun onClosed(eventSource: EventSource) {
                close()
            }
        }

        val source = EventSources.createFactory(client).newEventSource(request, listener)
        awaitClose { source.cancel() }
    }
}
