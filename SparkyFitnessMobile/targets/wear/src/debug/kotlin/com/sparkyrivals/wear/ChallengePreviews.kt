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
