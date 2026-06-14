package com.doppio

import com.doppio.core.network.dto.MeDto
import com.doppio.core.network.dto.SessionDetailResponseDto
import com.doppio.core.network.dto.SessionsResponseDto
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** A2: DTOs must tolerate the real API envelopes (incl. unknown keys, nulls, Bangla). */
class DtoSerializationTest {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Test
    fun parsesSessionsListWithCursor() {
        val payload = """
            {
              "sessions": [
                {"id":"c1","title":"নিউটনের লেকচার","source":"MOBILE","status":"READY",
                 "language":"bn","durationSec":312,"tags":["physics","class"],
                 "createdAt":"2026-06-14T09:00:00.000Z"},
                {"id":"c2","title":"Standup","source":"UPLOAD","status":"TRANSCRIBING",
                 "language":null,"durationSec":null,"tags":[],"createdAt":"2026-06-13T10:00:00.000Z",
                 "unexpected":"ignored"}
              ],
              "nextCursor":"c2"
            }
        """.trimIndent()

        val dto = json.decodeFromString<SessionsResponseDto>(payload)
        assertEquals(2, dto.sessions.size)
        assertEquals("c2", dto.nextCursor)
        assertEquals("নিউটনের লেকচার", dto.sessions[0].title)
        assertEquals(listOf("physics", "class"), dto.sessions[0].tags)
        assertNull(dto.sessions[1].durationSec)
        assertTrue(dto.sessions[1].tags.isEmpty())
    }

    @Test
    fun parsesSessionDetailWithChildren() {
        val payload = """
            {
              "session": {
                "id":"c1","title":"নিউটনের লেকচার","source":"MOBILE","status":"READY",
                "language":"bn","durationSec":312,"audioKey":null,"privateMode":false,
                "hasAudio":false,"tags":["physics"],"createdAt":"2026-06-14T09:00:00.000Z",
                "updatedAt":"2026-06-14T09:05:00.000Z",
                "transcript":[
                  {"id":"s0","idx":0,"startMs":0,"endMs":4000,"text":"আজকে আমরা গতিসূত্র পড়ব।","speaker":"A"},
                  {"id":"s1","idx":1,"startMs":4000,"endMs":8000,"text":"Next week is the exam."}
                ],
                "summary":{"overview":"Lecture on Newton's laws.","decisions":null,
                           "nextSteps":"Prepare for the exam.","language":"en"},
                "actionItems":[{"id":"a0","text":"Revise chapter 3","owner":null,"dueHint":"next week","done":false}],
                "notes":[{"id":"n0","anchorMs":4000,"text":"important","createdAt":"2026-06-14T09:02:00.000Z"}]
              }
            }
        """.trimIndent()

        val s = json.decodeFromString<SessionDetailResponseDto>(payload).session
        assertEquals("c1", s.id)
        assertEquals(2, s.transcript.size)
        assertEquals("A", s.transcript[0].speaker)
        assertNull(s.transcript[1].speaker)
        assertEquals("en", s.summary?.language)
        assertEquals("Lecture on Newton's laws.", s.summary?.overview)
        assertEquals(1, s.actionItems.size)
        assertEquals("next week", s.actionItems[0].dueHint)
        assertEquals(4000, s.notes[0].anchorMs)
        assertNull(s.notes[0].updatedAt)
    }

    @Test
    fun parsesMeProfile() {
        val me = json.decodeFromString<MeDto>(
            """{"id":"u1","email":"a@b.com","name":null,"locale":"bn","privateMode":true,
                "plan":"PRO","planExpiresAt":"2026-07-01T00:00:00.000Z"}""",
        )
        assertEquals("u1", me.id)
        assertEquals("bn", me.locale)
        assertTrue(me.privateMode)
        assertEquals("PRO", me.plan)
    }
}
