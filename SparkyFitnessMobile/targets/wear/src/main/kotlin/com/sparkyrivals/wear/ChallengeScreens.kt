package com.sparkyrivals.wear

import android.net.Uri
import android.text.format.DateUtils
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.sparkyrivals.companion.allowedSurfaceDestination
import androidx.compose.runtime.key
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnScope
import androidx.wear.compose.foundation.lazy.rememberTransformingLazyColumnState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.sparkyrivals.companion.ChallengeItem
import com.sparkyrivals.companion.ChallengeProtocol
import com.sparkyrivals.companion.ChallengeRow
import com.sparkyrivals.companion.ChallengeSnapshot
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@Composable
fun ChallengeApp(state: CompanionState, now: Long, surfaceLink: Pair<String?,String?> = null to null) {
    MaterialTheme {
        // New account/clear resets navigation and cannot retain a captured old item.
        key(state.receipt.snapshot.accountKey, state.receipt.resetRequired) {
            val nav = rememberSwipeDismissableNavController()
            LaunchedEffect(surfaceLink) {
                allowedSurfaceDestination(state.receipt.snapshot,surfaceLink.first,surfaceLink.second)?.let { nav.navigate("detail/${Uri.encode(it)}") }
            }
            AppScaffold {
                SwipeDismissableNavHost(navController = nav, startDestination = "challenges") {
                    composable("challenges") {
                        val snapshot = state.receipt.snapshot
                        when {
                            state.receipt.resetRequired -> CompanionMessage(R.string.reset_required, R.string.reset_hint)
                            snapshot.state != "ready" -> if (state.phoneReachable == false) CompanionMessage(R.string.phone_unavailable, R.string.open_phone) else CompanionMessage(R.string.not_synced, R.string.open_phone)
                            snapshot.items.isEmpty() -> WearList {
                                item { Heading(stringResource(R.string.empty_title)) }
                                item { Hint(stringResource(R.string.empty_hint)) }
                                if (snapshot.hasMore) item { Hint(stringResource(R.string.more_phone)) }
                                item { Freshness(snapshot, now) }
                            }
                            snapshot.items.size == 1 && !snapshot.hasMore -> ChallengeDetail(snapshot.items[0], snapshot, now)
                            else -> WearList {
                                item { Heading(stringResource(R.string.challenges)) }
                                items(snapshot.items.size, key = { snapshot.items[it].id }) { index ->
                                    val item = snapshot.items[index]
                                    Button(onClick = { nav.navigate("detail/${Uri.encode(item.id)}") }, modifier = Modifier.fillMaxWidth(),
                                        secondaryLabel = { Text(if (item.membership == "accepted" && item.lifecycle in listOf("active", "completed")) item.rows.firstOrNull { it.isSelf }?.let { if(it.daysWithData > 0) score(it.total, item) else stringResource(noMetricData(item)) } ?: status(item) else status(item)) },
                                        label = { Text(item.name, maxLines = 2, overflow = TextOverflow.Ellipsis) })
                                }
                                if (snapshot.hasMore) item { Hint(stringResource(R.string.more_phone)) }
                                item { Freshness(snapshot, now) }
                            }
                        }
                    }
                    composable("detail/{id}") { entry ->
                        val snapshot = state.receipt.snapshot
                        val item = snapshot.items.firstOrNull { it.id == entry.arguments?.getString("id") }
                        if (item == null) CompanionMessage(R.string.challenges, R.string.unavailable_detail)
                        else ChallengeDetail(item, snapshot, now)
                    }
                }
            }
        }
    }
}

/** Wear foundation provides rotary scrolling; scaffolds provide time/scroll indicator.
 * Native typography and padding allow round displays and larger text to scroll. */
@Composable
private fun WearList(content: TransformingLazyColumnScope.() -> Unit) {
    val scroll = rememberTransformingLazyColumnState()
    ScreenScaffold(scrollState = scroll, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 38.dp)) { padding ->
        TransformingLazyColumn(modifier = Modifier.fillMaxSize(), state = scroll, contentPadding = padding,
            verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}
@Composable private fun CompanionMessage(title: Int, hint: Int) = WearList {
    item { Heading(stringResource(title)) }
    item { Hint(stringResource(hint)) }
}
@Composable private fun Heading(text: String) = Text(text, style = MaterialTheme.typography.titleMedium,
    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().semantics { heading() })
@Composable private fun Hint(text: String) = Text(text, style = MaterialTheme.typography.bodySmall,
    color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
@Composable private fun status(item: ChallengeItem): String = stringResource(when {
    item.membership == "pending" -> R.string.invitation
    item.lifecycle == "lobby" -> R.string.lobby
    item.lifecycle == "upcoming" -> R.string.upcoming
    item.lifecycle == "completed" -> R.string.completed
    else -> R.string.active
})
private fun number(value: Long) = NumberFormat.getIntegerInstance().format(value)
private fun day(value: String) = LocalDate.parse(value).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))

@Composable
fun ChallengeDetail(item: ChallengeItem, snapshot: ChallengeSnapshot, now: Long) = WearList {
    item { Text(item.name, style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().semantics { heading() }) }
    when {
        item.membership == "pending" -> {
            item { Heading(stringResource(if (item.lifecycle == "completed") R.string.review_phone else R.string.accept_phone)) }
            item { Hint(metricLabel(LocalContext.current, item)) }
        }
        item.lifecycle == "lobby" -> { item { Heading(stringResource(R.string.ready_phone)) } }
        item.lifecycle == "upcoming" -> {
            item { Heading(stringResource(R.string.start_date, day(item.startDate))) }
            item { Hint(metricLabel(LocalContext.current, item)) }
        }
        else -> {
            val own = item.rows.firstOrNull { it.isSelf }
            if (item.rows.isEmpty()) item { Hint(stringResource(R.string.results_pending)) }

            if (own != null) item { OwnScore(own, item, now) }
            // Keep the server's bounded row order, even when displayed numbers round alike.
            items(item.rows.size, key = { item.rows[it].id }) { index -> ParticipantScore(item.rows[index], item) }
            if (item.rows.any { it.daysWithData < it.eligibleDays }) item { Hint(stringResource(R.string.metric_coverage)) }
            if (item.lifecycle == "completed") item { Hint(stringResource(R.string.reconciled)) }
        }
    }
    item.participantCount?.let { count -> item { Hint(pluralStringResource(R.plurals.participants, count.toInt(), count.toInt())) } }
    if (item.lifecycle == "active") item { Hint(pluralStringResource(R.plurals.days_left, item.daysRemaining.toInt(), item.daysRemaining.toInt())) }
    if(item.lifecycle!="lobby") item { Hint(stringResource(R.string.date_range, day(item.startDate), day(item.endDate))) }
    item { Freshness(snapshot, now) }
}
@Composable private fun OwnScore(row: ChallengeRow, item: ChallengeItem, now: Long) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp).semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Hint(stringResource(R.string.your_total))
        Text(if(row.daysWithData > 0) score(row.total, item) else stringResource(noMetricData(item)),
            style = MaterialTheme.typography.numeralSmall, textAlign = TextAlign.Center)
        row.rank?.let { Hint(stringResource(if(row.tied) R.string.tied_rank else R.string.rank, number(it))) }
        if(item.lifecycle == "active") row.today?.let { point ->
            val today = Instant.ofEpochMilli(now).atZone(ZoneId.of(item.timezone)).toLocalDate().toString()
            val label = if (point.date == today) stringResource(R.string.today) else day(point.date)
            val value = when { !point.eligible -> stringResource(R.string.not_started); !point.present -> stringResource(noMetricData(item)); else -> score(point.value, item) }
            Hint(stringResource(R.string.dated_value, label, value))
        }
    }
}
@Composable private fun ParticipantScore(row: ChallengeRow, item: ChallengeItem) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp).semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        val name = if(row.isSelf) stringResource(R.string.you) else row.name
        Text(stringResource(R.string.ranked_name, row.rank?.let(::number) ?: "—", name),
            style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center)
        Text(if(row.daysWithData > 0) score(row.total, item) else stringResource(noMetricData(item)),
            style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        if(row.tied) Hint(stringResource(R.string.tied))
    }
}
@Composable private fun Freshness(snapshot: ChallengeSnapshot, now: Long) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.semantics(mergeDescendants = true) {}) {
        Hint(stringResource(R.string.updated, DateUtils.getRelativeTimeSpanString(snapshot.generatedAt, now, DateUtils.MINUTE_IN_MILLIS).toString()))
        if (ChallengeProtocol.stale(snapshot, now)) Text(stringResource(R.string.stale), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
    }
}

@Composable private fun score(value: Number, item: ChallengeItem): String = formatScore(LocalContext.current,value,item)
