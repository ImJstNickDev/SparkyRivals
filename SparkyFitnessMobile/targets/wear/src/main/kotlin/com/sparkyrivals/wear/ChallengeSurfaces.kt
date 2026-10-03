package com.sparkyrivals.wear

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.icu.text.MeasureFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.sparkyrivals.companion.ChallengeSurface
import com.sparkyrivals.companion.challengeSurface
import com.sparkyrivals.companion.workoutDurationParts
import java.text.NumberFormat
import java.util.Locale

/** Shared local presentation for the Tile and complication, never network data. */
data class SurfaceText(val title: String,val score: String,val rank: String,val status: String,val description: String,val model: ChallengeSurface)
fun surfaceText(context: Context): SurfaceText {
    val model=challengeSurface(ChallengeStore.get(context).state.value.receipt.snapshot,System.currentTimeMillis())
    val item=model.item
    fun score(value: Long): String = if(item?.metric=="workout_time") {
        val units=mapOf("hour" to MeasureUnit.HOUR,"minute" to MeasureUnit.MINUTE,"second" to MeasureUnit.SECOND)
        MeasureFormat.getInstance(Locale.getDefault(),MeasureFormat.FormatWidth.NARROW).formatMeasures(*workoutDurationParts(value).map { Measure(it.first,units.getValue(it.second)) }.toTypedArray())
    } else NumberFormat.getIntegerInstance().format(value)
    val own=model.own
    val title=item?.name ?: context.getString(R.string.challenges)
    val value=own?.let { if(it.daysWithData>0) score(it.total) else context.getString(if(item?.metric=="workout_time") R.string.no_workout else R.string.no_steps) } ?: "—"
    val rank=own?.rank?.let { context.getString(R.string.surface_rank,it) } ?: ""
    val status=when {
        model.state=="unavailable" -> context.getString(R.string.not_synced)
        item==null -> context.getString(R.string.empty_title)
        model.stale -> context.getString(R.string.stale)
        item.membership=="pending" -> context.getString(R.string.accept_phone)
        item.lifecycle=="upcoming" -> context.getString(R.string.upcoming)
        item.lifecycle=="completed" -> context.getString(R.string.completed)
        own?.leader==true -> if(item.leadMargin==0L) context.getString(R.string.surface_tied) else item.leadMargin?.let { context.getString(R.string.surface_ahead,score(it)) } ?: context.getString(R.string.surface_leading)
        else -> own?.gapToLeader?.let { context.getString(R.string.surface_behind,score(it)) } ?: context.getString(R.string.not_synced)
    }
    val unit=context.getString(if(item?.metric=="workout_time") R.string.workout_time else R.string.steps_label)
    return SurfaceText(title,value,rank,status,"$title, $rank, $value $unit, $status",model)
}
object ChallengeSurfaceLinks {
    const val ID="challengeId"
    const val ACCOUNT="challengeAccount"
    fun intent(context: Context, text: SurfaceText) = Intent(context,MainActivity::class.java)
        .setData(Uri.Builder().scheme("sparky-challenge-surface").authority("detail").appendPath(text.model.item?.id.orEmpty()).appendQueryParameter("account",text.model.accountKey).build())
        .putExtra(ID,text.model.item?.id).putExtra(ACCOUNT,text.model.accountKey)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    fun pending(context: Context,text: SurfaceText): PendingIntent = PendingIntent.getActivity(context,0,intent(context,text),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}
object ChallengeSurfaceUpdates {
    /** Local render updates only, after a changed receipt or privacy clear. */
    private var lastRefresh = 0L
    @Synchronized fun request(context: Context, privacyChange: Boolean) {
        val now = android.os.SystemClock.elapsedRealtime()
        if (!privacyChange && lastRefresh != 0L && now - lastRefresh < 300000L) return
        lastRefresh = now
        runCatching { TileService.getUpdater(context).requestUpdate(ChallengeTileService::class.java) }
        runCatching { ComplicationDataSourceUpdateRequester.create(context,ComponentName(context,ChallengeComplicationService::class.java)).requestUpdateAll() }
    }
}
