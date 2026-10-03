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
        modified["version"] = 2
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
        print("Watch Challenge model checks: \(checks) passed")
    }
}
