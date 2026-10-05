import Foundation

/// Runs against the real Foundation-only models/adapters on a Mac. No paired
/// phone, simulator, credentials or test-only parser. The same JSON is asserted
/// against buildWatchChallenges by Jest.
@main
struct ChallengeModelChecks {
    static func main() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let payload = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        var checks = 0
        func check(_ condition: @autoclosure () -> Bool, _ message: String) {
            precondition(condition(), message)
            checks += 1
        }
        let snapshot = ChallengePayloadMapper.snapshot(from: payload)!
        check(snapshot.items.count == 1, "valid snapshot")
        let item = snapshot.items[0]
        check(item.isVersus && item.rows.count == 2, "versus")
        check(item.ownRow?.total == 54280, "server total")
        check(item.leadMargin == 2287, "server margin")
        check(item.rows[0].today?.present == true && item.rows[0].today?.value == 0, "explicit zero")
        check(item.rows[1].today?.present == false, "missing day")
        check(snapshot.generatedAt == Date(timeIntervalSince1970: 1), "source timestamp")
        check(ChallengePayloadMapper.snapshot(from: nil) == nil, "old phone")
        check(ChallengePayloadMapper.snapshot(from: ["version": 1]) == nil, "partial snapshot")
        var modified = payload
        modified["version"] = 4
        check(ChallengePayloadMapper.snapshot(from: modified) == nil, "unknown version")
        modified = payload
        modified["state"] = "unavailable"
        check(ChallengePayloadMapper.snapshot(from: modified) == nil, "explicit clear")
        modified = payload
        modified["accountKey"] = ""
        check(ChallengePayloadMapper.snapshot(from: modified) == nil, "account guard")
        var row = (payload["items"] as! [[String: Any]])[0]
        row["membership"] = "pending"
        modified = payload
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows.isEmpty, "pending strips injected scores")
        row["membership"] = "accepted"
        row["lifecycle"] = "upcoming"
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows.isEmpty, "upcoming strips scores")
        row["lifecycle"] = "cancelled"
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items.isEmpty, "cancelled omitted")
        row = (payload["items"] as! [[String: Any]])[0]
        var rows = row["rows"] as! [[String: Any]]
        rows[0]["rank"] = 7
        row["rows"] = rows
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows[0].rank == 7, "no reranking")
        rows[0]["total"] = true
        row["rows"] = rows
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows.count == 1, "malformed boolean score dropped")
        rows[0]["total"] = Double.nan
        row["rows"] = rows
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows.count == 1, "NaN dropped")
        rows[0].removeValue(forKey: "total")
        row["rows"] = rows
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows.count == 1, "partial row dropped")
        row["rows"] = Array(repeating: rows[1], count: 100)
        modified["items"] = [row]
        check(ChallengePayloadMapper.snapshot(from: modified)!.items[0].rows.count == 1, "duplicate rows bounded")
        var previous = WatchContext.empty
        previous.challengeSnapshot = snapshot
        check(ContextPayloadMapper.context(from: [:], previous: previous).challengeSnapshot == nil, "absent context clears previous account")
        check(ContextPayloadMapper.context(from: ["challengeSnapshot": payload], previous: .empty).challengeSnapshot == snapshot, "composed context")
        check(ContextPayloadMapper.context(from: ["challengeSnapshot": ["state": "unavailable"]], previous: previous).challengeSnapshot == nil, "composed clear")
        let saved = try JSONEncoder().encode(previous)
        let restored = try JSONDecoder().decode(WatchContext.self, from: saved)
        check(restored.challengeSnapshot == snapshot, "persisted snapshot")
        var old = try JSONSerialization.jsonObject(with: saved) as! [String: Any]
        old.removeValue(forKey: "challengeSnapshot")
        let oldData = try JSONSerialization.data(withJSONObject: old)
        let restoredOld = try JSONDecoder().decode(WatchContext.self, from: oldData)
        check(restoredOld.challengeSnapshot == nil, "older saved context")
        check(WatchPage.visible(order: ["workout", "goals"], hidden: [], workoutActive: false).last == .challenge, "new page appends")
        check(!WatchPage.visible(order: nil, hidden: ["challenge"], workoutActive: false).contains(.challenge), "page hides")
        check(WatchPage.visible(order: nil, hidden: ["workout"], workoutActive: true).contains(.workout), "active workout preserved")
        check(!WatchPage.visible(order: nil, hidden: WatchPage.allCases.map(\.rawValue), workoutActive: false).isEmpty, "no empty page deck")
        let defaultPages = WatchPage.visible(order: nil, hidden: nil, workoutActive: false)
        check(WatchPage.initial(in: defaultPages, needsFirstRunEntry: true, workoutActive: false) == .entry, "missing weight initially selects first check-in")
        check(defaultPages.contains(.challenge), "missing weight does not remove Challenges")
        check(WatchPage.initial(in: defaultPages, needsFirstRunEntry: false, workoutActive: false) == .goals, "seeded launch preserves normal order")
        let reordered = WatchPage.visible(order: ["challenge", "entry"], hidden: nil, workoutActive: false)
        check(WatchPage.initial(in: reordered, needsFirstRunEntry: true, workoutActive: false) == .entry, "stale weight initially selects Entry without reordering")
        check(reordered.first == .challenge, "first check-in does not change saved order")
        check(WatchPage.initial(in: reordered, needsFirstRunEntry: false, workoutActive: false) == .challenge, "normal launch uses saved first page")
        let entryHidden = WatchPage.visible(order: ["challenge"], hidden: ["entry"], workoutActive: false)
        check(WatchPage.initial(in: entryHidden, needsFirstRunEntry: true, workoutActive: false) == .challenge, "missing weight respects hidden Entry")
        let activePages = WatchPage.visible(order: nil, hidden: ["workout"], workoutActive: true)
        check(WatchPage.initial(in: activePages, needsFirstRunEntry: true, workoutActive: true) == .workout, "active workout overrides first check-in")
        check(!WatchContext.empty.hasSeed && WatchContext.empty.challengeSnapshot == nil, "unsynced Challenges need no weight")
        var emptyChallenges = payload
        emptyChallenges["items"] = []
        let contextWithoutWeight = ContextPayloadMapper.context(from: ["challengeSnapshot": emptyChallenges], previous: .empty)
        check(!contextWithoutWeight.hasSeed && contextWithoutWeight.challengeSnapshot?.items.isEmpty == true, "empty Challenges need no weight")
        var goal = payload
        goal["version"] = 3
        var goalItem = (payload["items"] as! [[String: Any]])[0]
        goalItem["metric"] = "steps"
        goalItem["scoringMode"] = "goal_progress"
        goalItem["scoreUnit"] = "points"
        var goalRows = goalItem["rows"] as! [[String: Any]]
        goalRows[0]["total"] = 140.123456
        goalItem["rows"] = goalRows
        goal["items"] = [goalItem]
        let parsedGoal = ChallengePayloadMapper.snapshot(from: goal)!.items[0]
        check(parsedGoal.ownRow?.total == 140.123456, "fractional authoritative goal points")
        check(parsedGoal.unit == "points", "points are not steps")
        goalItem["lifecycle"] = "lobby"
        goalItem.removeValue(forKey: "startDate")
        goalItem.removeValue(forKey: "endDate")
        goal["items"] = [goalItem]
        let lobbySnapshot = ChallengePayloadMapper.snapshot(from: goal)!
        check(lobbySnapshot.items[0].rows.isEmpty, "lobby never exposes cached scores")
        check(ChallengeSurfaceSnapshot.make(lobbySnapshot).rank.isEmpty, "lobby complication has no rank")
        for (metric, unit) in [("distance", "meters"), ("active_calories", "kcal"), ("workout_calories", "kcal"), ("workout_distance", "meters")] {
            var modern = (payload["items"] as! [[String: Any]])[0]
            modern["metric"] = metric
            modern["scoreUnit"] = unit
            modern["scoringMode"] = "sum"
            goal["items"] = [modern]
            check(ChallengePayloadMapper.snapshot(from: goal)!.items[0].unit == unit, "canonical metric unit")
        }
        var workout = payload
        workout["version"] = 2
        var workoutItem = (payload["items"] as! [[String: Any]])[0]
        workoutItem["metric"] = "workout_time"
        workoutItem["scoreUnit"] = "seconds"
        workout["items"] = [workoutItem]
        let parsedWorkout = ChallengePayloadMapper.snapshot(from: workout)!.items[0]
        check(parsedWorkout.isWorkoutTime && parsedWorkout.isVersus, "workout unit")
        check(!ChallengeDurationFormat.string(4080).contains("4080"), "duration is formatted")
        check(!item.isWorkoutTime, "legacy Steps default")
        workout["version"] = 1
        check(ChallengePayloadMapper.snapshot(from: workout)!.items.isEmpty, "workout cannot masquerade as v1")
        let surface = ChallengeSurfaceSnapshot.make(snapshot)
        check(surface.accountKey == snapshot.accountKey, "complication account")
        check(surface.generatedAt == 1, "complication source freshness")
        check(surface.rank.contains("1"), "complication original rank")
        let cleared = ChallengeSurfaceSnapshot.make(nil)
        check(cleared.accountKey.isEmpty && cleared.score == "—", "complication clear")
        workout["version"] = 2
        let workoutSurface = ChallengeSurfaceSnapshot.make(ChallengePayloadMapper.snapshot(from: workout))
        check(workoutSurface.score == ChallengeDurationFormat.string(item.ownRow!.total), "complication duration")
        let roundTrip = try JSONDecoder().decode(ChallengeSurfaceSnapshot.self, from: JSONEncoder().encode(surface))
        check(roundTrip == surface, "minimal shared persistence")
        print("Watch Challenge model checks: \(checks) passed")
    }
}
