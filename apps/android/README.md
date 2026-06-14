# Doppio — Android

Native Android client for the Doppio backend. Implements the **Mobile (MVP-21)** seam from
[../../Doppio_Android_Implementation_Plan.md](../../Doppio_Android_Implementation_Plan.md).

## Status
Milestone **A0 — Scaffold & infra** (in progress). See the plan's "Build order" for A1–A9.

## Requirements
- **JDK 17**
- **Android SDK** with **API 36** platform + build-tools 36 (`compileSdk`/`targetSdk = 36`, `minSdk = 26`)
- Android Studio (Ladybug+) or the Gradle wrapper (`./gradlew`)

## Setup
1. `cp local.properties.example local.properties` and set `sdk.dir`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `API_BASE_URL` (all public client values — no secrets).
2. Build: `./gradlew :app:assembleDebug`
3. Install on a device/emulator: `./gradlew :app:installDebug`

## Architecture (per plan)
- Kotlin + Jetpack Compose (Material 3), MVVM + unidirectional state, Hilt DI.
- **supabase-kt** for auth (Bearer token) + signed Storage upload; **Retrofit/OkHttp** for the Doppio REST API.
- **Room** + **DataStore** for offline-first cache; **WorkManager** for reliable background capture.
- **MediaRecorder → .m4a** (STT-native), stored on-device; **Media3** for offline playback.

## Audio & privacy
The recording is kept **on the device only**; for transcription it is uploaded to Supabase Storage
and **deleted by the pipeline right after transcription**. The DB stores only transcript + summary.
Local audio is **excluded from Android Auto Backup** (see `res/xml/*backup*`).
