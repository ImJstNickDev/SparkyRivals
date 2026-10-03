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
}

struct ChallengeDay: Codable, Equatable {
    let date: String
    let value: Double
    let present: Bool
    let eligible: Bool
}
