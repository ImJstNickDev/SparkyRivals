#if DEBUG
import Foundation

/// Only ScreenshotSeed calls this; no fixture path exists in release builds.
/// Values stand in for server responses, including original group rank seven.
enum ScreenshotChallengeSeed {
    enum State: String {
        case versus, group, invitation, upcoming, completed, empty, multiple, stale, tied
        case workoutVersus, workoutGroup, workoutCompleted, workoutNoData
    }

    static func snapshot(state: String?) -> ChallengeSnapshot? {
        guard let state, let mode = State(rawValue: state) else { return nil }
        let own = participant(id: "you", name: "You", own: true, total: 54280, rank: 1, leader: true,
            gap: 0, today: 12410)
        let other = participant(id: "marta", name: "Marta", own: false, total: 51993, rank: 2, leader: false,
            gap: 2287, today: 13002)
        let versus = challenge(id: "versus", name: "A little further", rows: [own, other], count: 2)
        let group = challenge(id: "group", name: "Weekend walkers", rows: [
            participant(id: "alice", name: "Alice", own: false, total: 72302, rank: 1, leader: true, gap: 0, today: 7800),
            participant(id: "marta", name: "Marta", own: false, total: 68991, rank: 2, leader: false, gap: 3311, today: 6000),
            participant(id: "luca", name: "Luca", own: false, total: 65140, rank: 3, leader: false, gap: 7162, today: 0),
            participant(id: "you", name: "You", own: true, total: 51220, rank: 7, leader: false, gap: 21082, today: nil),
        ], count: 12)
        let invitation = challenge(id: "invitation", name: "Our next seven days", rows: [], count: nil,
            lifecycle: .upcoming, invitation: true)
        let upcoming = challenge(id: "upcoming", name: "Monday motivation", rows: [], count: 3, lifecycle: .upcoming)
        let completed = challenge(id: "completed", name: "Last week's steps", rows: [own, other], count: 2, lifecycle: .completed)
        let tied = challenge(id: "tied", name: "Every step counts", rows: [
            participant(id: "you", name: "You", own: true, total: 54280, rank: 1, leader: true, gap: 0, today: 0, tied: true),
            participant(id: "marta", name: "Marta", own: false, total: 54280, rank: 1, leader: true, gap: 0, today: nil, tied: true),
        ], count: 2, margin: 0)
        let workoutRows = [
            participant(id: "you", name: "You", own: true, total: 13320, rank: 1, leader: true, gap: 0, today: 2760, workout: true),
            participant(id: "marta", name: "Marta", own: false, total: 11880, rank: 2, leader: false, gap: 1440, today: mode == .workoutNoData ? nil : 3720, workout: true)
        ]
        let workout = challenge(id: "workout", name: "Time for us", rows: workoutRows, count: 2,
            lifecycle: mode == .workoutCompleted ? .completed : .active, margin: 1440, metric: .workoutTime)
        let workoutGroup = challenge(id: "workout-group", name: "Time together", rows: workoutRows + [
            participant(id: "alice", name: "Alice", own: false, total: 7200, rank: 3, leader: false, gap: 6120, today: 0, workout: true)
        ], count: 3, margin: 1440, metric: .workoutTime)
        let items: [WatchChallenge]
        switch mode {
        case .versus, .stale: items = [versus]
        case .group: items = [group]
        case .invitation: items = [invitation]
        case .upcoming: items = [upcoming]
        case .completed: items = [completed]
        case .empty: items = []
        case .multiple: items = [invitation, versus, group, upcoming, completed]
        case .tied: items = [tied]
        case .workoutVersus, .workoutCompleted, .workoutNoData: items = [workout]
        case .workoutGroup: items = [workoutGroup]
        }
        return ChallengeSnapshot(accountKey: "screenshot:account",
            generatedAt: Date().addingTimeInterval(mode == .stale ? -7200 : -120),
            items: items, hasMore: mode == .multiple)
    }

    private static func participant(
        id: String, name: String, own: Bool, total: Double, rank: Int, leader: Bool,
        gap: Double, today: Double?, tied: Bool = false, workout: Bool = false
    ) -> ChallengeParticipant {
        ChallengeParticipant(id: id, name: name, isSelf: own, total: total, rank: rank,
            tied: tied, leader: leader, gapToLeader: gap,
            today: ChallengeDay(date: CheckInDate.today(), value: today ?? 0, present: today != nil, eligible: true, workoutCount: workout ? (today == nil ? 0 : 1) : nil),
            daysWithSteps: today == nil ? 3 : 4, eligibleDays: 4, daysWithData: workout ? 3 : nil, workoutCount: workout ? 4 : nil)
    }

    private static func challenge(
        id: String, name: String, rows: [ChallengeParticipant], count: Int?,
        lifecycle: ChallengeLifecycle = .active, invitation: Bool = false, margin: Double = 2287, metric: ChallengeMetric? = nil
    ) -> WatchChallenge {
        func day(_ offset: Int) -> String {
            CheckInDate.formatter.string(from: Calendar.current.date(byAdding: .day, value: offset, to: Date())!)
        }
        let start = lifecycle == .completed ? -7 : lifecycle == .upcoming ? 2 : -3
        return WatchChallenge(id: id, name: name, lifecycle: lifecycle, isInvitation: invitation,
            startDate: day(start), endDate: day(start + 6), timezone: TimeZone.current.identifier,
            currentDay: lifecycle == .active ? 4 : nil, totalDays: 7,
            daysRemaining: lifecycle == .completed ? 0 : lifecycle == .upcoming ? 7 : 4,
            participantCount: count, calculatedAt: invitation ? nil : Date(),
            leadMargin: rows.isEmpty ? nil : margin, rows: rows, metric: metric)
    }
}
#endif
