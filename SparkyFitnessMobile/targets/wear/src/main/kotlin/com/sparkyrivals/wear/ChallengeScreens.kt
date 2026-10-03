package com.sparkyrivals.wear

import android.net.Uri
import android.text.format.DateUtils
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
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
fun ChallengeApp(state: CompanionState, now: Long) {
    MaterialTheme {
        // New account/clear resets navigation and cannot retain a captured old item.
        key(state.receipt.snapshot.accountKey, state.receipt.resetRequired) {
            val nav = rememberSwipeDismissableNavController()
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
                                        secondaryLabel = { Text(status(item)) }, label = { Text(item.name) })
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
    item.lifecycle == "upcoming" -> R.string.upcoming
    item.lifecycle == "completed" -> R.string.completed
    else -> R.string.active
})
private fun number(value: Long) = NumberFormat.getIntegerInstance().format(value)
private fun day(value: String) = LocalDate.parse(value).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))

@Composable
fun ChallengeDetail(item: ChallengeItem, snapshot: ChallengeSnapshot, now: Long) = WearList {
    item { Hint(status(item)) }
    item { Heading(item.name) }
    when {
        item.membership == "pending" -> {
            item { Heading(stringResource(if (item.lifecycle == "completed") R.string.review_phone else R.string.accept_phone)) }
            item { Hint(stringResource(R.string.steps_rule)) }
        }
        item.lifecycle == "upcoming" -> {
            item { Heading(stringResource(R.string.start_date, day(item.startDate))) }
            item { Hint(stringResource(R.string.steps_rule)) }
        }
        else -> {
            val own = item.rows.firstOrNull { it.isSelf }
            if (item.rows.isEmpty()) item { Hint(stringResource(R.string.results_pending)) }
            if (own != null) item { Lead(own, item) }
            // Presentation only: 1v1 places self first; group keeps server order/ranks.
            val rows = if (item.participantCount == 2L) item.rows.filter { it.isSelf } + item.rows.filterNot { it.isSelf } else item.rows
            items(rows.size, key = { rows[it].id }) { index -> ParticipantScore(rows[index], item, now, item.participantCount == 2L) }
            if (item.rows.any { it.daysWithSteps < it.eligibleDays }) item { Hint(stringResource(R.string.coverage)) }
            if (item.lifecycle == "completed") item { Hint(stringResource(R.string.reconciled)) }
        }
    }
    item.participantCount?.let { count -> item { Hint(pluralStringResource(R.plurals.participants, count.toInt(), count.toInt())) } }
    if (item.lifecycle == "active") item { Heading(pluralStringResource(R.plurals.days_left, item.daysRemaining.toInt(), item.daysRemaining.toInt())) }
    item { Hint(stringResource(R.string.date_range, day(item.startDate), day(item.endDate))) }
    item { Hint(item.timezone) }
    item { Freshness(snapshot, now) }
}
@Composable private fun Lead(own: ChallengeRow, item: ChallengeItem) {
    val text = when {
        own.leader && own.tied -> stringResource(R.string.tied_lead)
        own.leader && item.leadMargin != null -> stringResource(R.string.lead, number(item.leadMargin))
        own.gapToLeader != null && own.gapToLeader > 0 -> stringResource(R.string.behind, number(own.gapToLeader))
        own.rank != null -> stringResource(R.string.rank, number(own.rank))
        else -> null
    }
    if (text != null) Heading(text)
}
@Composable private fun ParticipantScore(row: ChallengeRow, item: ChallengeItem, now: Long, versus: Boolean) {
    Column(modifier = Modifier.fillMaxWidth().background(
        if (row.isSelf) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer,
        MaterialTheme.shapes.large).padding(horizontal = 12.dp, vertical = 10.dp).semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        val color = if (row.isSelf) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
        Text(if (row.isSelf) stringResource(R.string.you) else row.name, style = MaterialTheme.typography.titleSmall, color = color, textAlign = TextAlign.Center)
        Text(stringResource(R.string.steps, number(row.total)), style = if (versus) MaterialTheme.typography.displaySmall else MaterialTheme.typography.numeralSmall, color = color, textAlign = TextAlign.Center)
        row.rank?.let { Text(stringResource(R.string.rank, number(it)), color = color) }
        if (row.tied) Text(stringResource(R.string.tied), color = color)
        if (row.leader) Text(stringResource(if (item.lifecycle == "completed") { if (row.tied) R.string.current_tied_winner else R.string.current_winner } else R.string.leader), color = color)
        row.today?.let { point ->
            val today = Instant.ofEpochMilli(now).atZone(ZoneId.of(item.timezone)).toLocalDate().toString()
            Text(if (point.date == today) stringResource(R.string.today) else day(point.date), style = MaterialTheme.typography.labelSmall, color = color)
            Text(when { !point.eligible -> stringResource(R.string.not_started); !point.present -> stringResource(R.string.no_steps); else -> stringResource(R.string.steps, number(point.value)) }, color = color)
        }
    }
}
@Composable private fun Freshness(snapshot: ChallengeSnapshot, now: Long) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.semantics(mergeDescendants = true) {}) {
        Hint(stringResource(R.string.updated, DateUtils.getRelativeTimeSpanString(snapshot.generatedAt, now, DateUtils.MINUTE_IN_MILLIS).toString()))
        if (ChallengeProtocol.stale(snapshot, now)) Text(stringResource(R.string.stale), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
    }
}
