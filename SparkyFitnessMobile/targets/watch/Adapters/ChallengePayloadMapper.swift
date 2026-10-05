import Foundation
import CoreFoundation

/// Versioned, bounded subdocument of the existing context adapter. Invalid or
/// absent context clears Challenge state, never carries another account forward.
enum ChallengePayloadMapper {
    static func snapshot(from raw: Any?) -> ChallengeSnapshot? {
        guard let payload = raw as? [String: Any],
              let version = integer(payload["version"]), [1, 2, 3].contains(version),
              payload["state"] as? String == "ready",
              let accountKey = text(payload["accountKey"], limit: 300),
              let timestamp = number(payload["generatedAt"]), timestamp > 0,
              let items = payload["items"] as? [Any]
        else { return nil }
        var seen = Set<String>()
        let parsed = items.prefix(8).compactMap { item -> WatchChallenge? in
            guard let challenge = challenge(from: item, version: version), seen.insert(challenge.id).inserted else { return nil }
            return challenge
        }
        return ChallengeSnapshot(
            accountKey: accountKey,
            generatedAt: Date(timeIntervalSince1970: timestamp / 1000),
            items: parsed,
            hasMore: (payload["hasMore"] as? Bool ?? false) || items.count > 8
        )
    }

    private static func challenge(from raw: Any, version: Int) -> WatchChallenge? {
        guard let item = raw as? [String: Any],
              let id = text(item["id"]), let name = text(item["name"]),
              let state = item["lifecycle"] as? String,
              let lifecycle = ChallengeLifecycle(rawValue: state),
              let membership = item["membership"] as? String,
              ["pending", "accepted"].contains(membership),
              let timezone = text(item["timezone"]), TimeZone(identifier: timezone) != nil,
              let totalDays = integer(item["totalDays"]), (1...366).contains(totalDays),
              let daysRemaining = integer(item["daysRemaining"]), (0...366).contains(daysRemaining)
        else { return nil }
        let metricName = item["metric"] as? String ?? "steps"
        guard let metric = ChallengeMetric(rawValue: metricName) else { return nil }
        let mode = item["scoringMode"] as? String ?? "sum"
        let unit = item["scoreUnit"] as? String ?? "steps"
        let expectedUnit = mode == "goal_progress" ? "points" : mode == "goal_days" ? "goal_days" : metric.unit
        guard ["sum", "goal_progress", "goal_days"].contains(mode), unit == expectedUnit,
              metric != .hydration || mode != "sum", metric != .workoutDistance || mode == "sum",
              version == 3 || (mode == "sum" && (metric == .steps || (version == 2 && metric == .workoutTime))),
              lifecycle != .lobby || (version == 3 && mode != "sum")
        else { return nil }
        let startDate = lifecycle == .lobby ? "" : day(item["startDate"])
        let endDate = lifecycle == .lobby ? "" : day(item["endDate"])
        guard let startDate, let endDate, endDate >= startDate else { return nil }
        var seen = Set<String>()
        // Defense in depth: pending/upcoming payloads cannot smuggle scores.
        let rows: [ChallengeParticipant] = membership == "accepted" && lifecycle != .upcoming && lifecycle != .lobby
            ? (item["rows"] as? [Any] ?? []).prefix(4).compactMap { raw in
                guard let row = participant(from: raw, version: version), seen.insert(row.id).inserted else { return nil }
                return row
            } : []
        return WatchChallenge(
            id: id, name: name, lifecycle: lifecycle, isInvitation: membership == "pending",
            startDate: startDate, endDate: endDate, timezone: timezone,
            currentDay: integer(item["currentDay"]), totalDays: totalDays, daysRemaining: daysRemaining,
            participantCount: membership == "accepted" ? integer(item["participantCount"]) : nil,
            calculatedAt: ContextPayloadMapper.isoDate(from: item["calculatedAt"]),
            leadMargin: membership == "accepted" ? number(item["leadMargin"], fractional: version == 3) : nil,
            rows: rows, metric: metric, scoringMode: mode, scoreUnit: unit
        )
    }

    private static func participant(from raw: Any, version: Int) -> ChallengeParticipant? {
        guard let row = raw as? [String: Any],
              let id = text(row["id"]), let name = text(row["name"]),
              let isSelf = row["isSelf"] as? Bool,
              let total = number(row["total"], fractional: version == 3),
              let tied = row["tied"] as? Bool, let leader = row["leader"] as? Bool,
              let days = integer(row["daysWithData"] ?? row["daysWithSteps"]), let eligible = integer(row["eligibleDays"])
        else { return nil }
        return ChallengeParticipant(
            id: id, name: name, isSelf: isSelf, total: total, rank: integer(row["rank"]),
            tied: tied, leader: leader, gapToLeader: number(row["gapToLeader"], fractional: version == 3),
            today: point(from: row["today"], version: version), daysWithSteps: integer(row["daysWithSteps"]) ?? 0, eligibleDays: eligible,
            daysWithData: days, workoutCount: integer(row["workoutCount"])
        )
    }

    private static func point(from raw: Any?, version: Int) -> ChallengeDay? {
        guard let row = raw as? [String: Any], let date = day(row["date"]),
              let value = number(row["value"], fractional: version == 3), let present = row["present"] as? Bool,
              let eligible = row["eligible"] as? Bool else { return nil }
        return ChallengeDay(date: date, value: value, present: present, eligible: eligible, workoutCount: integer(row["workoutCount"]))
    }

    private static func text(_ raw: Any?, limit: Int = 100) -> String? {
        guard let value = raw as? String, !value.isEmpty else { return nil }
        return String(value.prefix(limit))
    }

    private static func number(_ raw: Any?, fractional: Bool = false) -> Double? {
        guard let value = raw as? NSNumber,
              CFGetTypeID(value) != CFBooleanGetTypeID(),
              value.doubleValue.isFinite, value.doubleValue >= 0,
              value.doubleValue <= (fractional ? 1e30 : 9_007_199_254_740_991),
              (fractional || value.doubleValue.rounded(.towardZero) == value.doubleValue)
        else { return nil }
        return value.doubleValue
    }

    private static func integer(_ raw: Any?) -> Int? {
        guard let value = number(raw), value <= 10_000 else { return nil }
        return Int(value)
    }

    private static func day(_ raw: Any?) -> String? {
        guard let value = raw as? String, value.count == 10,
              let parsed = CheckInDate.parse(value), CheckInDate.formatter.string(from: parsed) == value
        else { return nil }
        return value
    }
}
