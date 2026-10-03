package com.sparkyrivals.wear

import androidx.compose.runtime.Composable
import androidx.wear.compose.ui.tooling.preview.WearPreviewDevices
import androidx.wear.compose.ui.tooling.preview.WearPreviewFontScales
import com.sparkyrivals.companion.ChallengeItem
import com.sparkyrivals.companion.ChallengePoint
import com.sparkyrivals.companion.ChallengeReceipt
import com.sparkyrivals.companion.ChallengeRow
import com.sparkyrivals.companion.ChallengeSnapshot

/** Debug source set only. Never installed as runtime data or a hidden mock mode. */
private object Samples {
    const val NOW = 1791115200000L
    val own = ChallengeRow("self", "Nico", true, 54280, 1, false, true, 0, ChallengePoint("2026-10-04", 0, true, true), 2, 2)
    val peer = ChallengeRow("peer", "Marta", false, 51993, 2, false, false, 2287, ChallengePoint("2026-10-04", 0, false, true), 1, 2)
    val versus = ChallengeItem("weekly", "A little further", "active", "accepted", "2026-10-03", "2026-10-09", "Europe/Rome", 7, 6, 2, 2, 2287, listOf(own, peer))
    val group = versus.copy(participantCount = 9, rows = listOf(
        peer.copy(id = "alice", name = "Alice", total = 72302, rank = 1, leader = true, gapToLeader = 0),
        peer.copy(total = 68991, rank = 2), peer.copy(id = "luca", name = "Luca", total = 65140, rank = 3),
        own.copy(rank = 7, leader = false, gapToLeader = 18022)))
    val workout = versus.copy(name = "Time for us", metric = "workout_time", leadMargin = 1440, rows = listOf(
        own.copy(total = 13320, workoutCount = 4, today = own.today?.copy(value = 2760, workoutCount = 1)),
        peer.copy(total = 11880, gapToLeader = 1440, workoutCount = 3, today = peer.today?.copy(value = 3720, present = true, workoutCount = 1))))
    fun state(items: List<ChallengeItem> = listOf(versus), stale: Boolean = false) = CompanionState(
        ChallengeReceipt(snapshot = ChallengeSnapshot("preview", "ready", NOW - if (stale) 3600_000 else 60_000, items)))
}
@WearPreviewDevices @WearPreviewFontScales @Composable fun VersusPreview() = ChallengeApp(Samples.state(), Samples.NOW)
@WearPreviewDevices @Composable fun GroupPreview() = ChallengeApp(Samples.state(listOf(Samples.group)), Samples.NOW)
@WearPreviewDevices @Composable fun InvitationPreview() = ChallengeApp(Samples.state(listOf(Samples.versus.copy(membership = "pending", rows = emptyList(), participantCount = null, leadMargin = null))), Samples.NOW)
@WearPreviewDevices @Composable fun UpcomingPreview() = ChallengeApp(Samples.state(listOf(Samples.versus.copy(lifecycle = "upcoming", rows = emptyList(), leadMargin = null))), Samples.NOW)
@WearPreviewDevices @Composable fun CompletedPreview() = ChallengeApp(Samples.state(listOf(Samples.versus.copy(lifecycle = "completed", daysRemaining = 0))), Samples.NOW)
@WearPreviewDevices @Composable fun EmptyPreview() = ChallengeApp(Samples.state(emptyList()), Samples.NOW)
@WearPreviewDevices @Composable fun StalePreview() = ChallengeApp(Samples.state(stale = true), Samples.NOW)
@WearPreviewDevices @Composable fun MultiplePreview() = ChallengeApp(Samples.state(listOf(Samples.versus, Samples.group.copy(id = "group", name = "Friends on the move"))), Samples.NOW)
@WearPreviewDevices @Composable fun TiePreview() = ChallengeApp(Samples.state(listOf(Samples.versus.copy(leadMargin = 0, rows = listOf(Samples.own.copy(tied = true), Samples.peer.copy(total = 54280, rank = 1, tied = true, leader = true, gapToLeader = 0))))), Samples.NOW)
@WearPreviewDevices @Composable fun UninitializedPreview() = ChallengeApp(CompanionState(ChallengeReceipt()), Samples.NOW)

@WearPreviewDevices @WearPreviewFontScales @Composable fun WorkoutVersusPreview() = ChallengeApp(Samples.state(listOf(Samples.workout)), Samples.NOW)
@WearPreviewDevices @Composable fun WorkoutGroupPreview() = ChallengeApp(Samples.state(listOf(Samples.workout.copy(participantCount = 3, rows = Samples.workout.rows + Samples.peer.copy(id = "alice", name = "Alice", rank = 3, total = 7200, gapToLeader = 6120, workoutCount = 2)))), Samples.NOW)
@WearPreviewDevices @Composable fun WorkoutCompletedPreview() = ChallengeApp(Samples.state(listOf(Samples.workout.copy(lifecycle = "completed", daysRemaining = 0))), Samples.NOW)
@WearPreviewDevices @Composable fun WorkoutNoDataPreview() = ChallengeApp(Samples.state(listOf(Samples.workout.copy(rows = Samples.workout.rows.map { it.copy(today = it.today?.copy(value = 0, present = false, workoutCount = 0)) }))), Samples.NOW)
