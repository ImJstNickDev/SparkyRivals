package com.sparkyrivals.companion

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class ChallengeProtocolTest {
    private val publisher = "00000000-0000-4000-8000-000000000001"
    private fun fixture(): JSONObject = JSONObject(javaClass.getResource("/watch-challenges.json")!!.readText())
    private fun snapshot() = ChallengeProtocol.snapshot(fixture().toString())
    private fun envelope(sequence: Long = 1, snapshot: ChallengeSnapshot = snapshot()) = ChallengeEnvelope(publisher, sequence, snapshot)
    private fun invalid(block: () -> Unit) { try { block(); fail("expected rejection") } catch (_: IllegalArgumentException) {} catch (_: org.json.JSONException) {} catch (_: IllegalStateException) {} }

    @Test fun decodesSharedPhoneFixtureAndZeroPresence() {
        val snapshot = snapshot()
        assertEquals(54280L, snapshot.items[0].rows[0].total)
        assertEquals(0L, snapshot.items[0].rows[0].today!!.value)
        assertTrue(snapshot.items[0].rows[0].today!!.present)
        assertFalse(snapshot.items[0].rows[1].today!!.present)
    }
    @Test fun envelopeRoundTrip() { assertEquals(envelope(), ChallengeProtocol.decode(envelope().encode())) }
    @Test fun emptyAndTombstoneAreDifferent() {
        assertEquals("ready", snapshot().copy(items = emptyList()).state)
        assertEquals("unavailable", ChallengeProtocol.decode(envelope(snapshot = ChallengeSnapshot()).encode()).snapshot.state)
    }
    @Test fun pendingNeverDisclosesRows() {
        val json = fixture(); json.getJSONArray("items").getJSONObject(0).put("membership", "pending")
        assertTrue(ChallengeProtocol.snapshot(json.toString()).items[0].rows.isEmpty())
    }
    @Test fun upcomingNeverDisplaysScores() {
        val json = fixture(); json.getJSONArray("items").getJSONObject(0).put("lifecycle", "upcoming")
        assertTrue(ChallengeProtocol.snapshot(json.toString()).items[0].rows.isEmpty())
    }
    @Test fun completedIsReconciledWithoutMaximum() {
        val first = envelope().copy(snapshot = snapshot().copy(items = snapshot().items.map { it.copy(lifecycle = "completed") }))
        val next = first.copy(sequence = 2, snapshot = first.snapshot.copy(items = first.snapshot.items.map { it.copy(rows = it.rows.map { it.copy(total = 2) }) }))
        val receipt = ChallengeReceipt().receive("phone", first).receive("phone", next)
        assertEquals(2L, receipt.snapshot.items[0].rows[0].total)
    }
    @Test fun originalRankAndTieSurviveTruncation() {
        val row = snapshot().items[0].rows[0].copy(rank = 7, tied = true)
        val item = snapshot().items[0].copy(rows = listOf(row), participantCount = 100)
        val decoded = ChallengeProtocol.snapshot(snapshot().copy(items = listOf(item)).json().toString())
        assertEquals(7L, decoded.items[0].rows[0].rank)
        assertTrue(decoded.items[0].rows[0].tied)
        assertEquals(100L, decoded.items[0].participantCount)
    }
    @Test fun staleUsesSourceTimeNotDelivery() {
        assertFalse(ChallengeProtocol.stale(snapshot(), 1000 + ChallengeProtocol.STALE_MS - 1))
        assertTrue(ChallengeProtocol.stale(snapshot(), 1000 + ChallengeProtocol.STALE_MS))
    }
    @Test fun clearSurvivesRestartAndRejectsOldReady() {
        val ready = ChallengeReceipt().receive("phone", envelope())
        val cleared = ready.receive("phone", envelope(3, ChallengeSnapshot()))
        val restored = ChallengeReceipt.decode(cleared.encode())
        assertEquals(cleared, restored.receive("phone", envelope(2)))
        assertTrue(restored.snapshot.items.isEmpty())
    }
    @Test fun newAccountReplacesRatherThanMerges() {
        val state = ChallengeReceipt().receive("phone", envelope()).receive("phone", envelope(2, snapshot().copy(accountKey = "other:user", items = emptyList())))
        assertEquals("other:user", state.snapshot.accountKey)
        assertTrue(state.snapshot.items.isEmpty())
    }
    @Test fun duplicateAndReorderedEventsAreIgnored() {
        val latest = ChallengeReceipt().receive("phone", envelope(8))
        assertEquals(latest, latest.receive("phone", envelope(7)))
        assertEquals(latest, latest.receive("phone", envelope(8, ChallengeSnapshot())))
    }
    @Test fun phoneReinstallRequiresExplicitResetAndNeverResurrectsOldAccount() {
        val old = ChallengeReceipt().receive("phone", envelope())
        val changed = old.receive("phone", envelope(2).copy(publisherId = "00000000-0000-4000-8000-000000000002"))
        assertTrue(changed.resetRequired)
        assertTrue(changed.snapshot.items.isEmpty())
        assertEquals(changed, changed.receive("phone", envelope(20)))
        assertEquals(changed, ChallengeReceipt.decode(changed.encode()))
    }
    @Test fun anotherNodeRequiresReset() {
        assertTrue(ChallengeReceipt().receive("one", envelope()).receive("two", envelope(2)).resetRequired)
    }
    @Test fun unknownVersionsAndMalformedPayloadFailSafely() {
        invalid { ChallengeProtocol.decode(JSONObject(envelope().encode()).put("version", 2).toString()) }
        invalid { ChallengeProtocol.snapshot(fixture().put("version", 3).toString()) }
        invalid { ChallengeProtocol.decode("{") }
        invalid { ChallengeProtocol.decode(JSONObject(envelope().encode()).put("sequence", "-1").toString()) }
        invalid { ChallengeProtocol.decode(JSONObject(envelope().encode()).put("publisherId", "wrong").toString()) }
    }
    @Test fun rejectsNonNumericNegativeAndFractionalScores() {
        for (bad in listOf<Any>(true, "123", -1, 1.5)) {
            val json = fixture(); json.getJSONArray("items").getJSONObject(0).getJSONArray("rows").getJSONObject(0).put("total", bad)
            invalid { ChallengeProtocol.snapshot(json.toString()) }
        }
    }
    @Test fun boundsItemsRowsAndPayload() {
        val state = snapshot()
        invalid { ChallengeProtocol.snapshot(state.copy(items = List(9) { state.items[0].copy(id = "$it") }).json().toString()) }
        invalid { ChallengeProtocol.snapshot(state.copy(items = listOf(state.items[0].copy(rows = List(5) { state.items[0].rows[0].copy(id = "$it") }))).json().toString()) }
        invalid { ChallengeProtocol.decode(" ".repeat(ChallengeProtocol.MAX_BYTES + 1)) }
    }
    @Test fun rejectsInvalidDateAndZone() {
        val json = fixture(); json.getJSONArray("items").getJSONObject(0).put("timezone", "Wrong/Zone")
        try { ChallengeProtocol.snapshot(json.toString()); fail() } catch (_: java.time.DateTimeException) {}
        json.getJSONArray("items").getJSONObject(0).put("timezone", "UTC").put("startDate", "2026-02-30")
        try { ChallengeProtocol.snapshot(json.toString()); fail() } catch (_: java.time.DateTimeException) {}
    }
    @Test fun corruptStateCanBeClearedWithoutOldData() {
        val receipt = ChallengeReceipt().receive("phone", envelope()).invalidate()
        assertTrue(receipt.snapshot.items.isEmpty()); assertTrue(receipt.resetRequired)
    }
    @Test fun journalSequenceSurvivesRestartAndSkipsIdenticalSnapshots() {
        val first = ChallengeProtocol.nextPublication(null, snapshot(), publisher)
        val restored = ChallengeProtocol.decode(first.encode())
        assertEquals(first, ChallengeProtocol.nextPublication(restored, snapshot(), "unused"))
        val clear = ChallengeProtocol.nextPublication(restored, ChallengeSnapshot(), "unused")
        assertEquals(2L, clear.sequence)
        assertEquals(publisher, clear.publisherId)
        assertEquals("unavailable", clear.snapshot.state)
    }
    @Test fun futureSourceClockDoesNotPretendToBeFresh() {
        assertTrue(ChallengeProtocol.stale(snapshot().copy(generatedAt = 1_000_000), 1000))
    }
    @Test fun rejectsProgressAndParticipantBounds() {
        for ((key, value) in listOf("totalDays" to 0, "totalDays" to 367, "daysRemaining" to 8, "participantCount" to 101)) {
            val json = fixture(); json.getJSONArray("items").getJSONObject(0).put(key, value)
            invalid { ChallengeProtocol.snapshot(json.toString()) }
        }
    }


    @Test fun workoutMetricRoundTripsWithCountsAndPresence() {
        val json = fixture().put("version", 2)
        val item = json.getJSONArray("items").getJSONObject(0)
        item.put("metric", "workout_time").put("scoreUnit", "seconds")
        val rows = item.getJSONArray("rows")
        for (i in 0 until rows.length()) rows.getJSONObject(i).put("daysWithData", 1).put("workoutCount", 3)
        val parsed = ChallengeProtocol.snapshot(json.toString())
        assertEquals("workout_time", parsed.items[0].metric)
        assertEquals(3L, parsed.items[0].rows[0].workoutCount)
        assertTrue(parsed.items[0].rows[0].today!!.present)
        assertFalse(parsed.items[0].rows[1].today!!.present)
        assertEquals(parsed, ChallengeProtocol.snapshot(parsed.json().toString()))
        invalid { ChallengeProtocol.snapshot(json.put("version", 1).toString()) }
        json.put("version", 2); item.put("scoreUnit", "steps")
        invalid { ChallengeProtocol.snapshot(json.toString()) }
    }
    @Test fun durationFormattingRetainsSecondsAndZero() {
        assertEquals(listOf(1L to "hour", 8L to "minute"), workoutDurationParts(4080))
        assertEquals(listOf(0L to "minute"), workoutDurationParts(0))
        assertEquals(listOf(1L to "hour", 1L to "second"), workoutDurationParts(3601))
    }
}
