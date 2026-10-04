package com.sparkyrivals.companion

/** Selection and presentation only. Original server ranks and units survive unchanged. */
data class ChallengeSurface(val item: ChallengeItem?, val own: ChallengeRow?, val accountKey: String, val state: String, val stale: Boolean)
fun challengeSurface(snapshot: ChallengeSnapshot, now: Long): ChallengeSurface {
    fun priority(c: ChallengeItem) = if(c.membership == "accepted" && c.lifecycle == "active") 0 else if(c.membership == "pending") 1 else if(c.lifecycle == "lobby") 2 else if(c.lifecycle == "upcoming") 3 else 4
    val item = if(snapshot.state != "ready") null else snapshot.items.sortedWith { a,b ->
        val order=priority(a).compareTo(priority(b))
        if(order!=0) order else {
            val date=if(a.lifecycle=="upcoming" && b.lifecycle=="upcoming") a.startDate.compareTo(b.startDate) else b.endDate.compareTo(a.endDate)
            if(date!=0) date else a.id.compareTo(b.id)
        }
    }.firstOrNull()
    val own=if(item?.membership=="accepted" && item.lifecycle in listOf("active","completed")) item.rows.firstOrNull { it.isSelf } else null
    return ChallengeSurface(item,own,snapshot.accountKey,if(snapshot.state!="ready") "unavailable" else if(item==null) "empty" else item.lifecycle,ChallengeProtocol.stale(snapshot,now))
}
fun allowedSurfaceDestination(snapshot: ChallengeSnapshot, account: String?, id: String?): String? =
    if(snapshot.state=="ready" && snapshot.accountKey==account) snapshot.items.firstOrNull { it.id==id }?.id else null
