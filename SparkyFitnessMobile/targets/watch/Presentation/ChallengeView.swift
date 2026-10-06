import SwiftUI

/// One normal Watch page, with native drill-down when multiple items fit the
/// phone's bounded projection. No credentials, health reads or write actions.
struct ChallengeView: View {
    @EnvironmentObject private var store: CheckInStore

    var body: some View {
        NavigationStack {
            if let snapshot = store.context.challengeSnapshot {
                if snapshot.items.count == 1, !snapshot.hasMore, let item = snapshot.items.first {
                    ChallengeDetailView(challengeId: item.id, accountKey: snapshot.accountKey)
                } else if snapshot.items.isEmpty {
                    ChallengeMessageView(
                        title: snapshot.hasMore ? "More challenges on iPhone" : "No challenges yet", symbol: "flag.checkered",
                        message: snapshot.hasMore ? "Open Challenges on your iPhone to see older items." : "Create a challenge on your iPhone.",
                        updatedAt: snapshot.generatedAt
                    )
                } else {
                    List {
                            ForEach(snapshot.items) { item in
                                NavigationLink {
                                    ChallengeDetailView(challengeId: item.id, accountKey: snapshot.accountKey)
                                } label: {
                                    ChallengeSummary(item: item)
                                }
                                .listRowInsets(EdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10))
                            }
                            if snapshot.hasMore {
                                Text("More challenges on iPhone")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                            ChallengeFreshness(updatedAt: snapshot.generatedAt)
                    }
                    .listStyle(.carousel)
                    .navigationTitle("Challenges")
                }
            } else {
                ChallengeMessageView(
                    title: "Challenges not synced yet", symbol: "iphone.and.arrow.forward",
                    message: "Open the app on your iPhone to sync."
                )
            }
        }
        // A detail pushed under account A must not remain in B's navigation.
        .id(store.context.challengeSnapshot?.accountKey)
    }
}

private struct ChallengeSummary: View {
    let item: WatchChallenge

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(item.statusLabel, systemImage: item.isInvitation ? "envelope" : item.metricSymbol)
                .font(.caption2).foregroundStyle(.secondary)
            Text(item.name).font(.headline).lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            if !item.isInvitation, [.active, .completed].contains(item.lifecycle), let own = item.ownRow {
                Text(own.dataDays > 0 ? ChallengeFormat.score(own.total, item: item) : item.noData)
                    .font(.system(.title3, design: .rounded, weight: .semibold))
                    .monospacedDigit()
                Text(ChallengeFormat.rank(own)).font(.caption2).foregroundStyle(.secondary)
            } else if item.isInvitation {
                Text("Review on iPhone").font(.caption2)
            } else if item.lifecycle == .upcoming {
                Text("Starts \(ChallengeFormat.date(item.startDate))").font(.caption2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct ChallengeMessageView: View {
    let title: LocalizedStringKey
    let symbol: String
    let message: LocalizedStringKey
    var updatedAt: Date? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Image(systemName: symbol).font(.largeTitle).foregroundStyle(.tint)
                    .accessibilityHidden(true)
                Text(title).font(.headline)
                Text(message).font(.caption).foregroundStyle(.secondary)
                if let updatedAt { ChallengeFreshness(updatedAt: updatedAt) }
            }
            .multilineTextAlignment(.center)
            .padding(.vertical, 12)
        }
    }
}

struct ChallengeFreshness: View {
    let updatedAt: Date

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { timeline in
            VStack(spacing: 3) {
                if (timeline.date.timeIntervalSince(updatedAt) >= 15 * 60 || timeline.date.timeIntervalSince(updatedAt) < -5 * 60) {
                    Label("May be out of date", systemImage: "clock.arrow.circlepath")
                }
                Text(ChallengePresentationFormat.updated(updatedAt, now: timeline.date))
            }
            .font(.caption2).foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
        }
    }
}

// Presentation only. The server's lifecycle/rank is never derived from a clock.
extension WatchChallenge {
    var metricSymbol: String {
        (metric ?? .steps).symbol
    }

    var statusLabel: String {
        if isInvitation { return String(localized: "Invitation") }
        switch lifecycle {
        case .active: return String(localized: "Active")
        case .upcoming: return String(localized: "Upcoming")
        case .lobby: return String(localized: "Waiting for players")
        case .completed: return String(localized: "Completed")
        }
    }
}

enum ChallengeFormat {
    static func score(_ value: Double, item: WatchChallenge) -> String {
        item.formattedScore(value)
    }

    static func steps(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0)))
    }

    static func rank(_ row: ChallengeParticipant) -> String {
        guard let rank = row.rank else { return String(localized: "Results not synced yet") }
        return row.tied ? String(localized: "Tied at rank \(rank)") : String(localized: "Rank \(rank)")
    }

    static func dayLabel(_ day: String, timezone: String) -> String {
        // Display wording only. Lifecycle and scores remain the server's values.
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: timezone)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date()) == day ? String(localized: "Today") : date(day)
    }

    static func date(_ day: String) -> String {
        // Parse and format the calendar bucket in the same zone; no UTC shift.
        guard let value = CheckInDate.parse(day) else { return day }
        return value.formatted(.dateTime.month(.abbreviated).day())
    }
}
