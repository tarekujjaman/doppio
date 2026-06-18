package com.doppio.core.data.db

import androidx.room.TypeConverter
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

class Converters {
    @TypeConverter
    fun fromTags(tags: List<String>?): String =
        Json.encodeToString(ListSerializer(String.serializer()), tags ?: emptyList())

    @TypeConverter
    fun toTags(value: String?): List<String> =
        if (value.isNullOrBlank()) emptyList()
        else runCatching { Json.decodeFromString(ListSerializer(String.serializer()), value) }
            .getOrDefault(emptyList())
}
