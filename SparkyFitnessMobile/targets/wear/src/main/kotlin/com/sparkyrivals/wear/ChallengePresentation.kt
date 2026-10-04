package com.sparkyrivals.wear

import android.content.Context
import android.icu.text.MeasureFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import com.sparkyrivals.companion.ChallengeItem
import com.sparkyrivals.companion.workoutDurationParts
import java.text.NumberFormat
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
    val number=NumberFormat.getNumberInstance().apply { maximumFractionDigits=6 }
    val text=number.format(value)
    return when(item.scoreUnit) {
        "seconds" -> {
            val units=mapOf("hour" to MeasureUnit.HOUR,"minute" to MeasureUnit.MINUTE,"second" to MeasureUnit.SECOND)
            MeasureFormat.getInstance(Locale.getDefault(),MeasureFormat.FormatWidth.NARROW).formatMeasures(*workoutDurationParts(value.toLong()).map { Measure(it.first,units.getValue(it.second)) }.toTypedArray())
        }
        "meters" -> context.getString(R.string.distance_value,number.format(value.toDouble()/1000))
        "kcal" -> context.getString(R.string.calorie_value,text)
        "milliliters" -> context.getString(R.string.hydration_value,text)
        "points" -> context.getString(R.string.points_value,text)
        "goal_days" -> context.getString(R.string.goal_days_value,text)
        else -> context.getString(R.string.steps,text)
    }
}
