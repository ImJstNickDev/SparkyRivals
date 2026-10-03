import Foundation

/// Read-only server projections. No HealthKit inputs or scoring algorithms.
struct ChallengeSnapshot: Codable, Equatable {
    let accountKey: String
    let generatedAt: Date
    let items: [WatchChallenge]
    let hasMore: Bool
}

enum ChallengeLifecycle: String, Codable {
    case upcoming, active, completed
}

struct WatchChallenge: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let lifecycle: ChallengeLifecycle
    let isInvitation: Bool
    let startDate: String
    let endDate: String
    let timezone: String
    let currentDay: Int?
    let totalDays: Int
    let daysRemaining: Int
    let participantCount: Int?
    let calculatedAt: Date?
    let leadMargin: Double?
    let rows: [ChallengeParticipant]

    // Optional so persisted v1 Steps contexts remain decodable.
    var metric: ChallengeMetric? = nil
    var isWorkoutTime: Bool { metric == .workoutTime }
    var ownRow: ChallengeParticipant? { rows.first(where: \.isSelf) }
    var isVersus: Bool { participantCount == 2 && rows.count == 2 && ownRow != nil }
}

struct ChallengeParticipant: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let isSelf: Bool
    // Double also safely holds step totals on arm64_32; never convert to Int.
    let total: Double
    let rank: Int?
    let tied: Bool
    let leader: Bool
    let gapToLeader: Double?
    let today: ChallengeDay?
    let daysWithSteps: Int
    let eligibleDays: Int
    var daysWithData: Int? = nil
    var workoutCount: Int? = nil
    var dataDays: Int { daysWithData ?? daysWithSteps }
}

struct ChallengeDay: Codable, Equatable {
    let date: String
    let value: Double
    let present: Bool
    let eligible: Bool
    var workoutCount: Int? = nil
}

enum ChallengeMetric: String, Codable {
    case steps
    case workoutTime = "workout_time"
}

/// Formatting only; integer seconds remain authoritative server values.
enum ChallengeDurationFormat {
    static func string(_ seconds: Double) -> String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.hour, .minute, .second]
        formatter.unitsStyle = .abbreviated
        formatter.zeroFormattingBehavior = .dropAll
        return formatter.string(from: max(0, seconds)) ?? "0s"
    }
}
