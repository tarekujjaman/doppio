package com.doppio.core.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.FontFamily

// Bengali rendering note (plan A0 / A8):
// The Android system font already includes a Noto Sans Bengali fallback on all
// supported API levels, so Bengali transcripts render correctly with the default
// family below. For pixel-consistent typography across OEM skins, swap this for a
// Downloadable Fonts (Google Fonts "Noto Sans Bengali") FontFamily with the
// system family as the guaranteed fallback — wired in the A8 typography pass.
val AppFontFamily: FontFamily = FontFamily.Default

val DoppioTypography = Typography().run {
    copy(
        displayLarge = displayLarge.copy(fontFamily = AppFontFamily),
        displayMedium = displayMedium.copy(fontFamily = AppFontFamily),
        displaySmall = displaySmall.copy(fontFamily = AppFontFamily),
        headlineLarge = headlineLarge.copy(fontFamily = AppFontFamily),
        headlineMedium = headlineMedium.copy(fontFamily = AppFontFamily),
        headlineSmall = headlineSmall.copy(fontFamily = AppFontFamily),
        titleLarge = titleLarge.copy(fontFamily = AppFontFamily),
        titleMedium = titleMedium.copy(fontFamily = AppFontFamily),
        titleSmall = titleSmall.copy(fontFamily = AppFontFamily),
        bodyLarge = bodyLarge.copy(fontFamily = AppFontFamily),
        bodyMedium = bodyMedium.copy(fontFamily = AppFontFamily),
        bodySmall = bodySmall.copy(fontFamily = AppFontFamily),
        labelLarge = labelLarge.copy(fontFamily = AppFontFamily),
        labelMedium = labelMedium.copy(fontFamily = AppFontFamily),
        labelSmall = labelSmall.copy(fontFamily = AppFontFamily),
    )
}
