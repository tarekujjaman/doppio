package com.doppio.core.capture

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.SystemClock
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-scoped audio recorder → AAC/MPEG-4 (.m4a, audio/mp4) so it routes to the
 * primary Bangla STT (TwinMind) with no transcode. v1 records while the app is
 * foreground; a foreground service for background-safe mic is an A8 hardening item.
 */
@Singleton
class RecorderController @Inject constructor(
    @ApplicationContext private val context: Context,
    private val audioStore: AudioStore,
) {
    enum class Status { Idle, Recording, Paused }

    data class State(
        val status: Status = Status.Idle,
        val elapsedMs: Long = 0,
        val amplitude: Float = 0f, // 0..1
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var tickJob: Job? = null
    private var startedAtElapsed = 0L
    private var accumulatedMs = 0L

    val mimeType: String = "audio/mp4"

    fun start(): Boolean {
        if (_state.value.status != Status.Idle) return false
        val file = audioStore.newRecordingFile(System.currentTimeMillis())
        val rec = newRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioChannels(1)
            setAudioSamplingRate(44_100)
            setAudioEncodingBitRate(96_000)
            setOutputFile(file.absolutePath)
        }
        return try {
            rec.prepare()
            rec.start()
            recorder = rec
            outputFile = file
            accumulatedMs = 0
            startedAtElapsed = SystemClock.elapsedRealtime()
            _state.update { State(status = Status.Recording, elapsedMs = 0) }
            startTicking()
            true
        } catch (e: Exception) {
            runCatching { rec.release() }
            file.delete()
            _state.update { State() }
            false
        }
    }

    fun pause() {
        val rec = recorder ?: return
        if (_state.value.status != Status.Recording) return
        runCatching { rec.pause() }
        accumulatedMs += SystemClock.elapsedRealtime() - startedAtElapsed
        tickJob?.cancel()
        _state.update { it.copy(status = Status.Paused, amplitude = 0f, elapsedMs = accumulatedMs) }
    }

    fun resume() {
        val rec = recorder ?: return
        if (_state.value.status != Status.Paused) return
        runCatching { rec.resume() }
        startedAtElapsed = SystemClock.elapsedRealtime()
        _state.update { it.copy(status = Status.Recording) }
        startTicking()
    }

    /** Stops and returns the finished file (or null on failure / empty take). */
    fun stop(): File? {
        val rec = recorder ?: return null
        tickJob?.cancel()
        val file = outputFile
        val ok = runCatching {
            rec.stop()
            true
        }.getOrDefault(false)
        runCatching { rec.release() }
        recorder = null
        outputFile = null
        _state.update { State() }
        return if (ok && file != null && file.exists() && file.length() > 0) file else null
    }

    fun cancel() {
        val rec = recorder
        tickJob?.cancel()
        runCatching { rec?.stop() }
        runCatching { rec?.release() }
        outputFile?.delete()
        recorder = null
        outputFile = null
        _state.update { State() }
    }

    fun elapsedMs(): Long =
        accumulatedMs + if (_state.value.status == Status.Recording) {
            SystemClock.elapsedRealtime() - startedAtElapsed
        } else {
            0
        }

    private fun startTicking() {
        tickJob?.cancel()
        tickJob = scope.launch {
            while (true) {
                val amp = runCatching { recorder?.maxAmplitude ?: 0 }.getOrDefault(0)
                _state.update {
                    it.copy(
                        elapsedMs = elapsedMs(),
                        amplitude = (amp / 32767f).coerceIn(0f, 1f),
                    )
                }
                delay(100)
            }
        }
    }

    private fun newRecorder(): MediaRecorder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
}
