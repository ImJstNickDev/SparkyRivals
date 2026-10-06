package com.sparkyrivals.companion

import org.junit.Assert.*
import org.junit.Test
import java.util.Locale

class ChallengeDisplayTest {
    private val item = ChallengeItem("id","Synthetic","active","accepted","2026-10-01","2026-10-07","Europe/Rome",7,3,4,2,null,emptyList())
    @Test fun allMetricsKeepCanonicalUnitsAndServerValues() {
        for ((metric, unit) in mapOf("steps" to "steps", "distance" to "meters", "active_calories" to "kcal", "workout_time" to "seconds", "workout_calories" to "kcal", "workout_distance" to "meters", "hydration" to "points")) {
            val challenge = item.copy(metric=metric, scoreUnit=unit)
            assertTrue(challengeDisplay(140.0, challenge).value >= 0)
            assertEquals(unit, challenge.scoreUnit)
        }
    }
    @Test fun compactPointsAbove100HaveNoCapOrTrailingZeros() {
        val challenge = item.copy(scoreUnit="points",scoringMode="goal_progress")
        for (points in listOf(50,100,140,200)) assertEquals(points.toString(),displayNumber(challengeDisplay(points,challenge),Locale.US))
        assertEquals("13", displayNumber(challengeDisplay(13.020833,challenge),Locale.US))
        assertEquals("13,1",displayNumber(challengeDisplay(13.12,challenge),Locale.ITALIAN))
    }
    @Test fun tinyNonzeroGapIsNotShownAsZero() {
        val display = challengeDisplay(0.00001,item.copy(scoreUnit="points"))
        assertTrue(displayBelowPrecision(display))
        assertEquals("0.1",displayNumber(display,Locale.US))
        assertFalse(displayBelowPrecision(challengeDisplay(0,item.copy(scoreUnit="points"))))
        val duration = challengeDisplay(0.2,item.copy(scoreUnit="seconds"))
        assertTrue(displayBelowPrecision(duration))
        assertEquals(1.0,displayValueForFormatting(duration),0.0)
    }
    @Test fun largeScoresAndIntegerStepsAreFinite() {
        assertEquals("9,007,199,254,740,991",displayNumber(challengeDisplay(9007199254740991L,item),Locale.US))
        assertTrue(displayNumber(challengeDisplay(1e30,item.copy(scoreUnit="points")),Locale.US).isNotBlank())
    }
    @Test fun preferredDistanceAndEnergyUnitsArePresentationOnly() {
        assertEquals(1.0,challengeDisplay(1609.34,item.copy(scoreUnit="meters",displayUnit="mi")).value,0.000001)
        assertEquals(418.4,challengeDisplay(100,item.copy(scoreUnit="kcal",displayUnit="kJ")).value,0.000001)
        assertEquals("km",challengeDisplay(1000,item.copy(scoreUnit="meters")).unit)
    }
    @Test fun optionalUnitsSurvivePersistenceAndLegacyDefaults() {
        val modern=item.copy(metric="distance",scoreUnit="meters",scoringMode="sum",displayUnit="mi")
        val snapshot=ChallengeSnapshot("account","ready",1000,listOf(modern))
        assertEquals("mi",ChallengeProtocol.snapshot(snapshot.json().toString()).items[0].displayUnit)
        assertNull(ChallengeProtocol.snapshot(ChallengeSnapshot("account","ready",1000,listOf(item)).json().toString()).items[0].displayUnit)
        val invalid=snapshot.json();invalid.getJSONArray("items").getJSONObject(0).put("displayUnit","points")
        assertNull(ChallengeProtocol.snapshot(invalid.toString()).items[0].displayUnit)
    }
    @Test fun goalDaysUseIntegerCountAndSecondsHaveCompactUnits() {
        assertEquals("1",displayNumber(challengeDisplay(1,item.copy(scoreUnit="goal_days")),Locale.ITALIAN))
        assertEquals("hour",challengeDisplay(4080,item.copy(scoreUnit="seconds")).unit)
        assertEquals("minute",challengeDisplay(0,item.copy(scoreUnit="seconds")).unit)
    }
}
