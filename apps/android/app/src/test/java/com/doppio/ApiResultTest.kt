package com.doppio

import com.doppio.core.network.ApiErrorType
import com.doppio.core.network.mapErrorType
import org.junit.Assert.assertEquals
import org.junit.Test

/** A2: HTTP status + API error code must map to the right typed error. */
class ApiResultTest {
    @Test fun unauthorized() {
        assertEquals(ApiErrorType.Unauthorized, mapErrorType(401, null))
    }

    @Test fun quotaByStatusOrCode() {
        assertEquals(ApiErrorType.QuotaExceeded, mapErrorType(402, "QUOTA_EXCEEDED"))
        assertEquals(ApiErrorType.QuotaExceeded, mapErrorType(402, null))
        assertEquals(ApiErrorType.QuotaExceeded, mapErrorType(400, "BUDGET_EXCEEDED"))
    }

    @Test fun invalidState() {
        assertEquals(ApiErrorType.InvalidState, mapErrorType(409, null))
        assertEquals(ApiErrorType.InvalidState, mapErrorType(400, "INVALID_STATE"))
    }

    @Test fun badUpload() {
        assertEquals(ApiErrorType.BadUpload, mapErrorType(413, null))
        assertEquals(ApiErrorType.BadUpload, mapErrorType(415, null))
        assertEquals(ApiErrorType.BadUpload, mapErrorType(400, "UNSUPPORTED_TYPE"))
    }

    @Test fun notFoundServerUnknown() {
        assertEquals(ApiErrorType.NotFound, mapErrorType(404, null))
        assertEquals(ApiErrorType.Server, mapErrorType(500, null))
        assertEquals(ApiErrorType.Server, mapErrorType(503, null))
        assertEquals(ApiErrorType.Unknown, mapErrorType(418, null))
    }
}
