package com.doppio.core.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doppio.core.ui.theme.Coral500
import com.doppio.core.ui.theme.Paper
import com.doppio.core.ui.theme.Plum800
import com.doppio.core.ui.theme.Spark

/**
 * The Doppio mark — "you" (plum/paper) + "the echo" (coral) overlapping, with "the
 * spark" lens where they meet. Ported from the web logo system so branding is
 * identical across surfaces. [reversed] paints "you" in paper for dark/plum backdrops.
 */
@Composable
fun DoppioMark(
    modifier: Modifier = Modifier,
    size: Dp = 28.dp,
    reversed: Boolean = false,
) {
    val you = if (reversed) Paper else Plum800
    Canvas(modifier.size(size)) {
        val s = this.size.minDimension / 100f
        fun pt(x: Float, y: Float) = Offset(x * s, y * s)

        // you (cx42,cy46,r26) ; echo (cx62,cy58,r22)
        drawCircle(you, radius = 26f * s, center = pt(42f, 46f))
        drawCircle(Coral500, radius = 22f * s, center = pt(62f, 58f))

        // spark = echo clipped to the "you" disc
        val youDisc = Path().apply {
            addOval(Rect(16f * s, 20f * s, 68f * s, 72f * s))
        }
        clipPath(youDisc) {
            drawCircle(Spark, radius = 22f * s, center = pt(62f, 58f))
        }
    }
}

/** "Dop·p·io" with the echo p in coral. Inherits [LocalContentColor] for the body. */
@Composable
fun DoppioWordmark(
    modifier: Modifier = Modifier,
    color: Color = LocalContentColor.current,
    accent: Color = Coral500,
    style: TextStyle = MaterialTheme.typography.titleLarge,
) {
    Text(
        text = buildAnnotatedString {
            withStyle(SpanStyle(color = color)) { append("Dop") }
            withStyle(SpanStyle(color = accent)) { append("p") }
            withStyle(SpanStyle(color = color)) { append("io") }
        },
        style = style.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp),
        modifier = modifier,
    )
}

/** Mark + wordmark lockup — the standard brand signature. */
@Composable
fun DoppioLockup(
    modifier: Modifier = Modifier,
    markSize: Dp = 26.dp,
    color: Color = LocalContentColor.current,
    reversed: Boolean = false,
    style: TextStyle = MaterialTheme.typography.titleLarge,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        DoppioMark(size = markSize, reversed = reversed)
        Spacer(Modifier.width(8.dp))
        DoppioWordmark(color = color, style = style)
    }
}