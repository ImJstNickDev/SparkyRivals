package com.sparkyrivals.companion

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

/** Shared native read contract. No health samples, credentials, ranking or HTTP. */
object ChallengeProtocol {
    const val PATH = "/sparkyrivals/challenges/v1"
    const val PHONE_CAPABILITY = "sparkyrivals_challenge_phone_v1"
    const val MAX_BYTES = 40 * 1024
    const val STALE_MS = 15 * 60_000L
    fun stale(snapshot: ChallengeSnapshot, now: Long) = now - snapshot.generatedAt >= STALE_MS || snapshot.generatedAt > now + 5 * 60_000
    fun nextPublication(previous: ChallengeEnvelope?, snapshot: ChallengeSnapshot, newPublisher: String): ChallengeEnvelope =
        if (previous?.snapshot == snapshot) previous else ChallengeEnvelope(previous?.publisherId ?: newPublisher, Math.addExact(previous?.sequence ?: 0L, 1L), snapshot)
    fun snapshot(text: String): ChallengeSnapshot = decodeSnapshot(JSONObject(text))
    fun decode(text: String): ChallengeEnvelope {
        require(text.toByteArray(Charsets.UTF_8).size <= MAX_BYTES)
        val json = JSONObject(text)
        require(json.number("version") == 1L)
        val publisher = json.text("publisherId", 36).also { UUID.fromString(it) }
        val sequence = json.text("sequence", 19).also { require(it.matches(Regex("[1-9][0-9]*"))) }.toLong()
        return ChallengeEnvelope(publisher, sequence, decodeSnapshot(json.getJSONObject("snapshot")))
    }
    private fun decodeSnapshot(json: JSONObject): ChallengeSnapshot {
        require(json.number("version") == 1L)
        val state = json.text("state", 20)
        require(state == "ready" || state == "unavailable")
        if (state == "unavailable") return ChallengeSnapshot()
        val account = json.text("accountKey", 200).also { require(it.isNotBlank()) }
        val time = json.number("generatedAt").also { require(it > 0) }
        val items = json.getJSONArray("items").objects(8).map { item ->
            val lifecycle = item.text("lifecycle", 20).also { require(it in listOf("active", "upcoming", "completed")) }
            val membership = item.text("membership", 20).also { require(it in listOf("accepted", "pending")) }
            val start = item.day("startDate")
            val end = item.day("endDate").also { require(it >= start) }
            val zone = item.text("timezone", 100).also { ZoneId.of(it) }
            val totalDays = item.number("totalDays").also { require(it in 1..366) }
            val daysRemaining = item.number("daysRemaining").also { require(it <= totalDays) }
            val currentDay = item.optionalNumber("currentDay")?.also { require(it in 1..totalDays) }
            val participantCount = item.optionalNumber("participantCount")?.also { require(it in 1..100) }
            val rows = if (membership == "pending" || lifecycle == "upcoming") emptyList() else item.getJSONArray("rows").objects(4).map { row ->
                ChallengeRow(
                    row.text("id", 100), row.text("name", 200), row.bool("isSelf"), row.number("total"),
                    row.optionalNumber("rank")?.also { require(it in 1..100) }, row.bool("tied"), row.bool("leader"), row.optionalNumber("gapToLeader"),
                    row.optJSONObject("today")?.let { point ->
                        ChallengePoint(point.day("date"), point.number("value"), point.bool("present"), point.bool("eligible"))
                    }, row.number("daysWithSteps"), row.number("eligibleDays")
                )
            }.also { require(it.map { row -> row.id }.distinct().size == it.size); require(it.count { row -> row.isSelf } <= 1) }
            ChallengeItem(item.text("id", 100), item.text("name", 200), lifecycle, membership, start, end, zone,
                totalDays, daysRemaining, currentDay,
                participantCount, item.optionalNumber("leadMargin"), rows)
        }.also { require(it.map { item -> item.id }.distinct().size == it.size) }
        return ChallengeSnapshot(account, state, time, items, json.bool("hasMore"))
    }
}
private fun JSONObject.text(key: String, max: Int): String = (get(key) as? String ?: error(key)).also { require(it.length <= max) }
private fun JSONObject.bool(key: String): Boolean = get(key) as? Boolean ?: error(key)
private fun JSONObject.number(key: String): Long {
    val value = get(key) as? Number ?: error(key)
    val number = value.toDouble()
    require(number.isFinite() && number >= 0 && number <= 9007199254740991.0 && number % 1.0 == 0.0)
    return number.toLong()
}
private fun JSONObject.optionalNumber(key: String): Long? = if (!has(key) || isNull(key)) null else number(key)
private fun JSONObject.day(key: String): String = text(key, 10).also { require(it.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))); LocalDate.parse(it) }
private fun JSONArray.objects(max: Int): List<JSONObject> { require(length() <= max); return (0 until length()).map { getJSONObject(it) } }

data class ChallengePoint(val date: String, val value: Long, val present: Boolean, val eligible: Boolean) {
    fun json() = JSONObject().put("date", date).put("value", value).put("present", present).put("eligible", eligible)
}
data class ChallengeRow(val id: String, val name: String, val isSelf: Boolean, val total: Long, val rank: Long?, val tied: Boolean, val leader: Boolean, val gapToLeader: Long?, val today: ChallengePoint?, val daysWithSteps: Long, val eligibleDays: Long) {
    fun json() = JSONObject().put("id", id).put("name", name).put("isSelf", isSelf).put("total", total).put("rank", rank)
        .put("tied", tied).put("leader", leader).put("gapToLeader", gapToLeader).put("today", today?.json())
        .put("daysWithSteps", daysWithSteps).put("eligibleDays", eligibleDays)
}
data class ChallengeItem(val id: String, val name: String, val lifecycle: String, val membership: String, val startDate: String, val endDate: String, val timezone: String, val totalDays: Long, val daysRemaining: Long, val currentDay: Long?, val participantCount: Long?, val leadMargin: Long?, val rows: List<ChallengeRow>) {
    fun json() = JSONObject().put("id", id).put("name", name).put("lifecycle", lifecycle).put("membership", membership)
        .put("startDate", startDate).put("endDate", endDate).put("timezone", timezone).put("totalDays", totalDays)
        .put("daysRemaining", daysRemaining).put("currentDay", currentDay).put("participantCount", participantCount)
        .put("leadMargin", leadMargin).put("rows", JSONArray(rows.map { it.json() }))
}
data class ChallengeSnapshot(val accountKey: String = "", val state: String = "unavailable", val generatedAt: Long = 0, val items: List<ChallengeItem> = emptyList(), val hasMore: Boolean = false) {
    fun json() = JSONObject().put("version", 1).put("accountKey", accountKey).put("state", state).put("generatedAt", generatedAt)
        .put("items", JSONArray(items.map { it.json() })).put("hasMore", hasMore)
}
data class ChallengeEnvelope(val publisherId: String, val sequence: Long, val snapshot: ChallengeSnapshot) {
    fun encode() = JSONObject().put("version", 1).put("publisherId", publisherId).put("sequence", sequence.toString()).put("snapshot", snapshot.json()).toString()
}

/** Durable receipt keeps the sequence watermark even after a clear. A changed
 * phone installation is never implicitly trusted: clear Wear app data to rebind. */
data class ChallengeReceipt(val nodeId: String = "", val publisherId: String = "", val sequence: Long = 0, val snapshot: ChallengeSnapshot = ChallengeSnapshot(), val resetRequired: Boolean = false) {
    fun receive(node: String, envelope: ChallengeEnvelope): ChallengeReceipt {
        if (resetRequired) return this
        if (nodeId.isNotEmpty() && (nodeId != node || publisherId != envelope.publisherId)) return copy(snapshot = ChallengeSnapshot(), resetRequired = true)
        if (nodeId.isNotEmpty() && envelope.sequence <= sequence) return this
        return ChallengeReceipt(node, envelope.publisherId, envelope.sequence, envelope.snapshot)
    }
    fun invalidate() = copy(snapshot = ChallengeSnapshot(), resetRequired = true)
    fun encode() = JSONObject().put("nodeId", nodeId).put("publisherId", publisherId).put("sequence", sequence.toString())
        .put("snapshot", snapshot.json()).put("resetRequired", resetRequired).toString()
    companion object {
        fun decode(text: String): ChallengeReceipt {
            val json = JSONObject(text)
            return ChallengeReceipt(json.getString("nodeId"), json.getString("publisherId"), json.getString("sequence").toLong(), ChallengeProtocol.snapshot(json.getJSONObject("snapshot").toString()), json.getBoolean("resetRequired"))
        }
    }
}
