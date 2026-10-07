package com.sparkyrivals.wear

import android.content.Context
import android.icu.text.MeasureFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import com.sparkyrivals.companion.ChallengeItem
import com.sparkyrivals.companion.challengeDisplay
import com.sparkyrivals.companion.displayNumber
import com.sparkyrivals.companion.displayBelowPrecision
import com.sparkyrivals.companion.displayValueForFormatting

import java.util.Locale

fun metricLabel(context: Context, item: ChallengeItem): String = context.getString(when(item.metric) {
    "distance" -> R.string.distance_label
    "active_calories" -> R.string.active_calories_label
    "workout_time" -> R.string.workout_time
    "workout_calories" -> R.string.workout_calories_label
    "workout_distance" -> R.string.workout_distance_label
    "hydration" -> R.string.hydration_label
    else -> R.string.steps_label
})
fun noMetricData(item: ChallengeItem): Int = when {
    item.metric.startsWith("workout_") -> R.string.no_workout
    item.metric == "steps" -> R.string.no_steps
    else -> R.string.no_metric_data
}
/** Unit formatting shared by the app, Tile and complication. Never ranks data. */
fun formatScore(context: Context, value: Number, item: ChallengeItem): String {
    val display = challengeDisplay(value, item)
    if (!display.value.isFinite() || display.value < 0) return "—"
    val locale = context.resources.configuration.locales[0] ?: Locale.getDefault()
    val text = displayNumber(display, locale)
    val formatted = when(display.unit) {
        "hour", "minute", "second" -> {
            val unit = when(display.unit) { "hour" -> MeasureUnit.HOUR; "minute" -> MeasureUnit.MINUTE; else -> MeasureUnit.SECOND }
            val number = android.icu.text.NumberFormat.getNumberInstance(locale).apply { maximumFractionDigits = display.decimals }
            MeasureFormat.getInstance(locale, MeasureFormat.FormatWidth.SHORT, number).format(Measure(displayValueForFormatting(display), unit))
        }
        "km" -> context.getString(R.string.distance_value, text)
        "mi" -> context.getString(R.string.miles_value, text)
        "kcal" -> context.getString(R.string.calorie_value, text)
        "kJ" -> context.getString(R.string.kilojoules_value, text)
        "L" -> context.getString(R.string.liters_value, text)
        "fl_oz" -> context.getString(R.string.ounces_value, text)
        "ml" -> context.getString(R.string.hydration_value, text)
        "points" -> context.getString(R.string.points_value, text)
        "goal_days" -> if (value.toDouble() <= 366) context.resources.getQuantityString(R.plurals.goal_days, value.toInt(), value.toInt()) else "—"
        else -> context.getString(R.string.steps, text)
    }
    return if(displayBelowPrecision(display)) context.getString(R.string.less_than, formatted) else formatted
}

/** Short complication title describes the score unit, not the underlying metric. */
fun surfaceUnit(context: Context, item: ChallengeItem?): String = context.getString(when(item?.scoreUnit) {
    "points" -> R.string.surface_points_short
    "goal_days" -> R.string.surface_days_short
    "meters" -> if(item.displayUnit == "mi") R.string.surface_miles_short else R.string.surface_km_short
    "kcal" -> if(item.displayUnit == "kJ") R.string.surface_kj_short else R.string.surface_kcal_short
    "milliliters" -> R.string.surface_ml_short
    "seconds" -> R.string.surface_time_short
    "steps" -> R.string.steps_label
    else -> R.string.challenges
})
