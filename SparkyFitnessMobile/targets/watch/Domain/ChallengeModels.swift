import Foundation

/// Read-only server projections. No HealthKit inputs or scoring algorithms.
struct ChallengeSnapshot: Codable, Equatable {
    let accountKey: String
    let generatedAt: Date
    let items: [WatchChallenge]
    let hasMore: Bool
}

enum ChallengeLifecycle: String, Codable {
    case upcoming, active, completed, lobby
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
    var scoringMode: String? = nil
    var scoreUnit: String? = nil
    var displayUnit: String? = nil
    var unit: String { scoreUnit ?? (metric ?? .steps).unit }
    var metricLabel: String { (metric ?? .steps).label }
    var noData: String {
        if [.workoutTime, .workoutCalories, .workoutDistance].contains(metric ?? .steps) { return String(localized: "No workout recorded") }
        return metric == nil || metric == .steps ? String(localized: "No step data") : String(localized: "No data recorded")
    }
    func formattedScore(_ value: Double) -> String {
        ChallengePresentationFormat.score(value, unit: unit, displayUnit: displayUnit)
    }

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
    case distance
    case activeCalories = "active_calories"
    case workoutCalories = "workout_calories"
    case workoutDistance = "workout_distance"
    case hydration
    var unit: String {
        switch self {
        case .steps: return "steps"
        case .distance, .workoutDistance: return "meters"
        case .activeCalories, .workoutCalories: return "kcal"
        case .workoutTime: return "seconds"
        case .hydration: return "milliliters"
        }
    }
    var symbol: String {
        switch self {
        case .steps: return "figure.walk"
        case .distance, .workoutDistance: return "location"
        case .activeCalories, .workoutCalories: return "flame"
        case .workoutTime: return "timer"
        case .hydration: return "drop"
        }
    }
    var label: String {
        switch self {
        case .steps: return String(localized: "Steps")
        case .distance: return String(localized: "Distance")
        case .activeCalories: return String(localized: "Active calories")
        case .workoutTime: return String(localized: "Workout time")
        case .workoutCalories: return String(localized: "Workout calories")
        case .workoutDistance: return String(localized: "Workout distance")
        case .hydration: return String(localized: "Hydration")
        }
    }
}

/// Formatting only; integer seconds remain authoritative server values.
enum ChallengeDurationFormat {
    static func string(_ seconds: Double) -> String {
        // Compact magnitude-aware duration; no conversion to 32-bit Int.
        if seconds >= 3600 { return ChallengePresentationFormat.measurement(seconds / 3600, unit: UnitDuration.hours, decimals: 1) }
        if seconds >= 60 { return ChallengePresentationFormat.measurement(seconds / 60, unit: UnitDuration.minutes, decimals: 1) }
        return ChallengePresentationFormat.measurement(max(0, seconds), unit: UnitDuration.seconds, decimals: 0)
    }
}
