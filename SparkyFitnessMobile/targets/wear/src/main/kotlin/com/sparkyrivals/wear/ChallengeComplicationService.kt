package com.sparkyrivals.wear

import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.ComplicationRequest

class ChallengeComplicationService : ComplicationDataSourceService() {
    override fun onComplicationRequest(request: ComplicationRequest, listener: ComplicationRequestListener) {
        val value=surfaceText(this)
        val description=PlainComplicationText.Builder(value.description).build()
        val tap=ChallengeSurfaceLinks.pending(this,value)
        val data=when(request.complicationType) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                PlainComplicationText.Builder(value.model.own?.rank?.let { "#$it" } ?: "—").build(),description)
                .setTitle(PlainComplicationText.Builder(if(value.model.stale) getString(R.string.surface_stale_short) else getString(if(value.model.item?.metric=="workout_time") R.string.surface_time_short else R.string.steps_label)).build()).setTapAction(tap).build()
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                PlainComplicationText.Builder("${value.rank} · ${value.score} · ${value.status}").build(),description)
                .setTitle(PlainComplicationText.Builder(value.title).build()).setTapAction(tap).build()
            else -> null
        }
        listener.onComplicationData(data)
    }
    override fun getPreviewData(type: ComplicationType): ComplicationData? = when(type) {
        ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(PlainComplicationText.Builder("#1").build(),PlainComplicationText.Builder(getString(R.string.challenges)).build()).build()
        ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(PlainComplicationText.Builder(getString(R.string.challenges)).build(),PlainComplicationText.Builder(getString(R.string.challenges)).build()).build()
        else -> null
    }
}
