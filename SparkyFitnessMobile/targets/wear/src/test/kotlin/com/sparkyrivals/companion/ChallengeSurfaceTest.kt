package com.sparkyrivals.companion
import org.junit.Assert.*
import org.junit.Test

class ChallengeSurfaceTest {
    private val row=ChallengeRow("self","You",true,3600,7,false,false,1000,null,1,2,1)
    private val item=ChallengeItem("id","Weekly","active","accepted","2026-10-01","2026-10-07","Europe/Rome",7,3,4,10,50,listOf(row),"workout_time")
    private val snapshot=ChallengeSnapshot("account","ready",1000,listOf(item),false)
    @Test fun keepsSelfRankAndWorkoutSeconds() { val model=challengeSurface(snapshot,2000);assertEquals(7L,model.own?.rank);assertEquals(3600L,model.own?.total);assertEquals("workout_time",model.item?.metric) }
    @Test fun prioritizesActiveOverPending() { val pending=item.copy(id="pending",membership="pending");assertEquals("id",challengeSurface(snapshot.copy(items=listOf(pending,item)),2000).item?.id) }
    @Test fun pendingCannotExposeRows() { assertNull(challengeSurface(snapshot.copy(items=listOf(item.copy(membership="pending"))),2000).own) }
    @Test fun upcomingCannotExposeRows() { assertNull(challengeSurface(snapshot.copy(items=listOf(item.copy(lifecycle="upcoming"))),2000).own) }
    @Test fun tiesPreserved() { assertTrue(challengeSurface(snapshot.copy(items=listOf(item.copy(rows=listOf(row.copy(tied=true))))),2000).own!!.tied) }
    @Test fun zeroVersusAbsent() { assertEquals(1L,challengeSurface(snapshot.copy(items=listOf(item.copy(rows=listOf(row.copy(total=0))))),2000).own?.daysWithData);assertEquals(0L,challengeSurface(snapshot.copy(items=listOf(item.copy(rows=listOf(row.copy(total=0,daysWithData=0))))),2000).own?.daysWithData) }
    @Test fun completedReconciles() { assertEquals(200L,challengeSurface(snapshot.copy(items=listOf(item.copy(lifecycle="completed",rows=listOf(row.copy(total=200))))),2000).own?.total) }
    @Test fun sourceTimeNotRenderTime() { assertTrue(challengeSurface(snapshot,1000000).stale);assertEquals(1000L,snapshot.generatedAt) }
    @Test fun clearAndEmptyAreDistinct() { assertEquals("unavailable",challengeSurface(ChallengeSnapshot(),2000).state);assertEquals("empty",challengeSurface(snapshot.copy(items=emptyList()),2000).state) }
    @Test fun accountGuardRejectsOldAndUnknownLinks() { assertEquals("id",allowedSurfaceDestination(snapshot,"account","id"));assertNull(allowedSurfaceDestination(snapshot,"old","id"));assertNull(allowedSurfaceDestination(snapshot,"account","unknown"));assertNull(allowedSurfaceDestination(ChallengeSnapshot(),"account","id")) }
    @Test fun stableSelection() { assertEquals("a",challengeSurface(snapshot.copy(items=listOf(item.copy(id="z"),item.copy(id="a"))),2000).item?.id) }
}
