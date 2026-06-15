package com.doppio.core.capture

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.abs

/**
 * Live recorder for near-real-time transcription. Captures 16 kHz mono PCM via
 * AudioRecord and cuts it into ~90s WAV chunks (emitted via [onChunk]) so they can be
 * transcribed WHILE recording — by Stop the transcript is basically done. Also writes
 * the full recording to a local WAV file for offline playback. Reuses
 * [RecorderController.State]/[RecorderController.Status] so the UI is unchanged.
 */
@Singleton
class LiveRecorder @Inject constructor(
    private val audioStore: AudioStore,
) {
    private val _state = MutableStateFlow(RecorderController.State())
    val state: StateFlow<RecorderController.State> = _state.asStateFlow()

    /** Invoked on the recording thread for each ~90s WAV chunk + the final partial one. */
    @Volatile
    var onChunk: ((index: Int, startMs: Long, wav: ByteArray) -> Unit)? = null

    private var record: AudioRecord? = null
    private var thread: Thread? = null
    @Volatile private var running = false
    @Volatile private var paused = false

    private var outFile: File? = null
    private var raf: RandomAccessFile? = null
    private var totalPcmBytes = 0L
    private val chunkBuf = ByteArrayOutputStream(CHUNK_BYTES)
    private var chunkIndex = 0
    private var chunkStartMs = 0L

    @SuppressLint("MissingPermission") // RECORD_AUDIO is checked before start() is called
    fun start(): Boolean {
        if (running) return false
        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING)
        if (minBuf <= 0) return false
        val rec = AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, CHANNEL, ENCODING, maxOf(minBuf, READ_BYTES * 2))
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            runCatching { rec.release() }
            return false
        }
        val file = audioStore.newWavFile(System.currentTimeMillis())
        val r = RandomAccessFile(file, "rw")
        r.setLength(0)
        r.write(ByteArray(WAV_HEADER)) // placeholder; real header written in stop()

        record = rec
        outFile = file
        raf = r
        totalPcmBytes = 0
        chunkIndex = 0
        chunkStartMs = 0
        chunkBuf.reset()
        running = true
        paused = false
        rec.startRecording()
        _state.update { RecorderController.State(status = RecorderController.Status.Recording) }
        thread = Thread({ readLoop() }, "doppio-live-rec").apply { start() }
        return true
    }

    private fun readLoop() {
        val buf = ByteArray(READ_BYTES)
        val rec = record ?: return
        while (running) {
            val n = rec.read(buf, 0, buf.size)
            if (n <= 0) continue
            if (paused) continue // keep draining AudioRecord but discard while paused
            runCatching { raf?.write(buf, 0, n) }
            chunkBuf.write(buf, 0, n)
            totalPcmBytes += n
            updateMeter(buf, n)
            if (chunkBuf.size() >= CHUNK_BYTES) cutChunk()
        }
    }

    private fun cutChunk() {
        val pcm = chunkBuf.toByteArray()
        chunkBuf.reset()
        if (pcm.isEmpty()) return
        val idx = chunkIndex++
        val start = chunkStartMs
        chunkStartMs += pcm.size / BYTES_PER_MS
        onChunk?.invoke(idx, start, encodeWav(pcm))
    }

    private fun updateMeter(buf: ByteArray, n: Int) {
        var peak = 0
        var i = 0
        while (i + 1 < n) {
            val s = (buf[i].toInt() and 0xff) or (buf[i + 1].toInt() shl 8)
            val a = abs(s)
            if (a > peak) peak = a
            i += 2
        }
        _state.update {
            it.copy(elapsedMs = totalPcmBytes / BYTES_PER_MS, amplitude = (peak / 32768f).coerceIn(0f, 1f))
        }
    }

    fun pause() {
        if (running) {
            paused = true
            _state.update { it.copy(status = RecorderController.Status.Paused, amplitude = 0f) }
        }
    }

    fun resume() {
        if (running) {
            paused = false
            _state.update { it.copy(status = RecorderController.Status.Recording) }
        }
    }

    /** Stops, emits the final chunk, finalizes the WAV header, returns the local file (or null). */
    fun stop(): File? {
        if (!running) return null
        running = false
        runCatching { thread?.join(1500) }
        runCatching { record?.stop() }
        runCatching { record?.release() }
        record = null
        if (chunkBuf.size() > 0) cutChunk()
        val file = outFile
        finalizeWav()
        val hadAudio = totalPcmBytes > 0
        outFile = null
        _state.update { RecorderController.State() }
        return file?.takeIf { hadAudio }
    }

    fun cancel() {
        running = false
        runCatching { thread?.join(1000) }
        runCatching { record?.stop() }
        runCatching { record?.release() }
        record = null
        runCatching { raf?.close() }
        raf = null
        outFile?.delete()
        outFile = null
        chunkBuf.reset()
        _state.update { RecorderController.State() }
    }

    fun elapsedMs(): Long = totalPcmBytes / BYTES_PER_MS

    private fun finalizeWav() {
        val r = raf ?: return
        runCatching {
            r.seek(0)
            r.write(wavHeader(totalPcmBytes.toInt()))
            r.close()
        }
        raf = null
    }

    private fun encodeWav(pcm: ByteArray): ByteArray {
        val out = ByteArrayOutputStream(WAV_HEADER + pcm.size)
        out.write(wavHeader(pcm.size))
        out.write(pcm)
        return out.toByteArray()
    }

    private fun wavHeader(pcmLen: Int): ByteArray {
        val bb = ByteBuffer.allocate(WAV_HEADER).order(ByteOrder.LITTLE_ENDIAN)
        bb.put("RIFF".toByteArray(Charsets.US_ASCII))
        bb.putInt(36 + pcmLen)
        bb.put("WAVE".toByteArray(Charsets.US_ASCII))
        bb.put("fmt ".toByteArray(Charsets.US_ASCII))
        bb.putInt(16)
        bb.putShort(1) // PCM
        bb.putShort(1) // mono
        bb.putInt(SAMPLE_RATE)
        bb.putInt(SAMPLE_RATE * 2) // byte rate
        bb.putShort(2) // block align
        bb.putShort(16) // bits per sample
        bb.put("data".toByteArray(Charsets.US_ASCII))
        bb.putInt(pcmLen)
        return bb.array()
    }

    private companion object {
        const val SAMPLE_RATE = 16_000
        const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
        const val BYTES_PER_MS = SAMPLE_RATE * 2 / 1000 // 32
        const val CHUNK_BYTES = 45 * SAMPLE_RATE * 2 // ~45s ≈ 1.44 MB — smaller tail = faster finalize
        const val READ_BYTES = 8_000 // ~0.25s reads — snappier stop + smoother meter
        const val WAV_HEADER = 44
    }
}
