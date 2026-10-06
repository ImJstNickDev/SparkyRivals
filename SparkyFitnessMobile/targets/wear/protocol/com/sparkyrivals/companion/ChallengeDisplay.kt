package com.sparkyrivals.companion

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.pow

/** Display conversion only. Never changes totals, ties or ranks in the snapshot. */
data class ChallengeDisplay(val value: Double, val unit: String, val decimals: Int)
fun challengeDisplay(value: Number, item: ChallengeItem): ChallengeDisplay {
    val actual = value.toDouble()
    return when(item.scoreUnit) {
        "meters" -> if(item.displayUnit == "mi") ChallengeDisplay(actual / 1609.34, "mi", 2) else ChallengeDisplay(actual / 1000, "km", 2)
        "kcal" -> if(item.displayUnit == "kJ") ChallengeDisplay(actual * 4.184, "kJ", 1) else ChallengeDisplay(actual, "kcal", 1)
        "milliliters" -> when(item.displayUnit) { "L" -> ChallengeDisplay(actual / 1000, "L", 2); "fl_oz" -> ChallengeDisplay(actual / 29.5735, "fl_oz", 1); else -> ChallengeDisplay(actual, "ml", 0) }
        "seconds" -> when { actual >= 3600 -> ChallengeDisplay(actual / 3600, "hour", 1); actual >= 60 || actual == 0.0 -> ChallengeDisplay(actual / 60, "minute", 1); else -> ChallengeDisplay(actual, "second", 0) }
        "steps", "goal_days" -> ChallengeDisplay(actual, item.scoreUnit, 0)
        else -> ChallengeDisplay(actual, "points", 1)
    }
}
fun displayNumber(display: ChallengeDisplay, locale: Locale): String = NumberFormat.getNumberInstance(locale).apply {
    maximumFractionDigits = display.decimals
    minimumFractionDigits = 0
}.format(displayValueForFormatting(display))
fun displayValueForFormatting(display: ChallengeDisplay) = if (displayBelowPrecision(display)) 10.0.pow(-display.decimals) else display.value
fun displayBelowPrecision(display: ChallengeDisplay) = display.value > 0 && display.value < 10.0.pow(-display.decimals)
