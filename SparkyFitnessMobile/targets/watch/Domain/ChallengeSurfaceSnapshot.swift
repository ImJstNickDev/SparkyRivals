import Foundation

/// Minimal presentation copied to the existing Watch App Group. No health history.
struct ChallengeSurfaceSnapshot: Codable, Equatable {
    let version: Int
    let accountKey: String
    let generatedAt: Double
    let title: String
    let score: String
    let metric: String
    let rank: String
    let status: String

    static func make(_ snapshot: ChallengeSnapshot?) -> Self {
        guard let snapshot else {
            return Self(version: 1, accountKey: "", generatedAt: 0, title: String(localized: "Challenges"), score: "—", metric: "", rank: "", status: String(localized: "Open iPhone to sync"))
        }
        func priority(_ item: WatchChallenge) -> Int {
            !item.isInvitation && item.lifecycle == .active ? 0 : item.isInvitation ? 1 : item.lifecycle == .upcoming ? 2 : 3
        }
        let item = snapshot.items.sorted {
            if priority($0) != priority($1) { return priority($0) < priority($1) }
            if $0.lifecycle == .upcoming && $1.lifecycle == .upcoming {
                return $0.startDate == $1.startDate ? $0.id < $1.id : $0.startDate < $1.startDate
            }
            if $0.endDate != $1.endDate { return $0.endDate > $1.endDate }
            return $0.id < $1.id
        }.first
        guard let item else {
            return Self(version: 1, accountKey: snapshot.accountKey, generatedAt: snapshot.generatedAt.timeIntervalSince1970, title: String(localized: "Challenges"), score: "—", metric: "", rank: "", status: String(localized: "No challenges yet"))
        }
        func format(_ value: Double) -> String {
            item.isWorkoutTime ? ChallengeDurationFormat.string(value) : value.formatted(.number.precision(.fractionLength(0)))
        }
        let own = item.ownRow
        let scored = !item.isInvitation && item.lifecycle != .upcoming && own != nil
        let score = scored ? (own!.dataDays > 0 ? format(own!.total) : (item.isWorkoutTime ? String(localized: "No workout recorded") : String(localized: "No step data"))) : "—"
        let rank = scored ? own?.rank.map { String(localized: "Rank \($0)") } ?? "" : ""
        let status: String
        if item.isInvitation { status = String(localized: "Accept on iPhone") }
        else if item.lifecycle == .upcoming { status = String(localized: "Starts \(item.startDate)") }
        else if item.lifecycle == .completed { status = String(localized: "Completed") }
        else if own?.leader == true {
            status = item.leadMargin == 0 ? String(localized: "Tied for lead") : item.leadMargin.map { "+\(format($0))" } ?? String(localized: "Leading")
        } else { status = own?.gapToLeader.map { String(localized: "\(format($0)) behind") } ?? String(localized: "Open to sync") }
        return Self(version: 1, accountKey: snapshot.accountKey, generatedAt: snapshot.generatedAt.timeIntervalSince1970, title: item.name, score: score, metric: item.isWorkoutTime ? String(localized: "Workout time") : String(localized: "Steps"), rank: rank, status: status)
    }
}
