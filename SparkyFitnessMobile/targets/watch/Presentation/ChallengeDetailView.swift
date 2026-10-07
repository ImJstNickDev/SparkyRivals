import SwiftUI

struct ChallengeDetailView: View {
    @EnvironmentObject private var store: CheckInStore
    let challengeId: String
    let accountKey: String

    // Resolve on every context update, not a captured NavigationLink value.
    // A cancellation, departure, account change or correction replaces this UI.
    private var item: WatchChallenge? {
        guard store.context.challengeSnapshot?.accountKey == accountKey else { return nil }
        return store.context.challengeSnapshot?.items.first { $0.id == challengeId }
    }

    var body: some View {
        if let item, let snapshot = store.context.challengeSnapshot {
            ScrollView {
                VStack(spacing: 10) {
                    Text(item.metricLabel).font(.caption2).foregroundStyle(.secondary)
                    Text(item.name).font(.headline).multilineTextAlignment(.center)
                        .accessibilityAddTraits(.isHeader)
                    if item.isInvitation {
                        invitation(item)
                    } else if item.lifecycle == .lobby {
                        Text("Waiting for players").font(.headline)
                        Text("Review readiness on iPhone").font(.caption)
                    } else if item.lifecycle == .upcoming {
                        Label("Starts \(ChallengeFormat.date(item.startDate))", systemImage: "calendar")
                            .font(.headline)
                        rules(item)
                    } else if item.rows.isEmpty {
                        Text("Results not synced yet").font(.caption).foregroundStyle(.secondary)
                    } else {
                        ChallengeScoresView(item: item)
                        if item.lifecycle == .active {
                            if item.daysRemaining == 1 {
                                Text("Last day").font(.caption)
                            } else {
                                Text("\(item.daysRemaining) days left").font(.caption)
                            }
                        } else {
                            Text("Results can change with late or corrected data.")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    if item.lifecycle != .lobby {
                        Text("\(ChallengeFormat.date(item.startDate)) – \(ChallengeFormat.date(item.endDate))")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    if item.isInvitation || item.lifecycle == .upcoming {
                        Text(item.timezone).font(.caption2).foregroundStyle(.secondary)
                    }
                    ChallengeFreshness(updatedAt: snapshot.generatedAt)
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 6)
            }
        } else {
            ChallengeMessageView(title: "Challenge unavailable", symbol: "iphone",
                message: "Open Challenges on your iPhone for the latest list.")
        }
    }

    @ViewBuilder
    private func invitation(_ item: WatchChallenge) -> some View {
        Image(systemName: "envelope.badge").font(.largeTitle).foregroundStyle(.tint)
            .accessibilityHidden(true)
        rules(item)
        if item.lifecycle == .completed {
            Text("Invitation ended").font(.headline)
            Text("Review on iPhone").font(.caption).foregroundStyle(.secondary)
        } else {
            Text("Accept on iPhone").font(.headline)
            Text("Scores are shared only after you accept.")
                .font(.caption2).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func rules(_ item: WatchChallenge) -> some View {
        Label(item.metricLabel, systemImage: item.metricSymbol).font(.caption)
        if let count = item.participantCount {
            Text("\(count) participants").font(.caption).foregroundStyle(.secondary)
        }
    }
}
