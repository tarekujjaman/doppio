# Doppio Android — R8/ProGuard keeps (release only).

# kotlinx.serialization: keep @Serializable metadata + generated serializers.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class com.doppio.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.doppio.**$$serializer { *; }

# Retrofit / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepattributes Signature, Exceptions
-keep,allowobfuscation interface retrofit2.** { *; }

# Ktor (used by supabase-kt)
-dontwarn io.ktor.**
-keep class io.ktor.** { *; }

# Supabase
-dontwarn io.github.jan.**

# Models (DTOs) used by serialization/reflection
-keep class com.doppio.**.dto.** { *; }
