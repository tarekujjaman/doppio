package com.doppio

import com.doppio.core.network.dto.HealthDto
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Sanity test (A0): the JSON config used by the network layer tolerates the
 *  real /api/health envelope and unknown keys. Real DTO coverage lands in A2. */
class JsonConfigTest {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Test
    fun parsesHealthEnvelope() {
        val dto = json.decodeFromString<HealthDto>(
            """{"ok":true,"service":"doppio-web","db":true,"extra":"ignored"}""",
        )
        assertTrue(dto.ok)
        assertEquals("doppio-web", dto.service)
        assertEquals(true, dto.db)
    }
}
