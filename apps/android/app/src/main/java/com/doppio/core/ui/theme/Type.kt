package com.doppio.core.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Bengali rendering note (plan A0 / A8):
// The Android system font already includes a Noto Sans Bengali fallback on all
// supported API levels, so Bengali transcripts render correctly with the default
// family below. For pixel-consistent typography across OEM skins, swap this for a
// Downloadable Fonts (Google Fonts "Inter" + "Noto Sans Bengali") FontFamily with the
// system family as the guaranteed fallback.
val AppFontFamily: FontFamily = FontFamily.Default

// A tightened, confident scale: bold display/headlines with negative tracking for a
// modern wordmark feel; comfortable reading sizes for transcripts/summaries.
val DoppioTypography = Typography().run {
    copy(
        displaySmall = displaySmall.copy(
            fontFamily = AppFontFamily, fontWeight = FontWeight.Bold,
            fontSize = 34.sp, lineHeight = 40.sp, letterSpacing = (-0.5).sp,
        ),
        headlineMedium = headlineMedium.copy(
            fontFamily = AppFontFamily, fontWeight = FontWeight.Bold,
            fontSize = 26.sp, lineHeight = 32.sp, letterSpacing = (-0.4).sp,
        ),
        headlineSmall = headlineSmall.copy(
            fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold,
            fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = (-0.3).sp,
        ),
        titleLarge = titleLarge.copy(
            fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold,
            fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = (-0.2).sp,
        ),
        titleMedium = titleMedium.copy(
            fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp, lineHeight = 22.sp, letterSpacing = 0.sp,
        ),
        titleSmall = titleSmall.copy(fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold),
        bodyLarge = bodyLarge.copy(fontFamily = AppFontFamily, fontSize = 16.sp, lineHeight = 24.sp),
        bodyMedium = bodyMedium.copy(fontFamily = AppFontFamily, fontSize = 14.sp, lineHeight = 21.sp),
        bodySmall = bodySmall.copy(fontFamily = AppFontFamily, fontSize = 12.sp, lineHeight = 17.sp),
        labelLarge = labelLarge.copy(fontFamily = AppFontFamily, fontWeight = FontWeight.SemiBold),
        labelMedium = labelMedium.copy(fontFamily = AppFontFamily, fontWeight = FontWeight.Medium),
        labelSmall = labelSmall.copy(
            fontFamily = AppFontFamily, fontWeight = FontWeight.Medium, letterSpacing = 0.4.sp,
        ),
    )
}

// Convenience for the recording timer / mono-ish numerals.
val MonoNumerals = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.SemiBold)