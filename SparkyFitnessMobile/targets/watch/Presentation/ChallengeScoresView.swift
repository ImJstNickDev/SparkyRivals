import SwiftUI

struct ChallengeScoresView: View {
    let item: WatchChallenge

    var body: some View {
        VStack(spacing: 10) {
            if item.isVersus, let own = item.ownRow,
               let opponent = item.rows.first(where: { !$0.isSelf }) {
                // Stacked hierarchy reads at large text sizes without squeezing
                // two five/six-digit scores into half a watch display.
                VStack(spacing: 2) {
                    Text("You").font(.caption).foregroundStyle(.secondary)
                    Text(item.formattedScore(own.total))
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
                    Text(item.metricLabel).font(.caption2).foregroundStyle(.secondary)
                    Text(ChallengeFormat.rank(own)).font(.caption2)
                    if let count = own.workoutCount { Text("\(count) workouts").font(.caption2) }
                }
                .accessibilityElement(children: .combine)
                VStack(spacing: 2) {
                    Text(opponent.name).font(.caption).lineLimit(2)
                    Text(ChallengeFormat.score(opponent.total, item: item))
                        .font(.system(.title3, design: .rounded, weight: .semibold)).monospacedDigit()
                }
                .accessibilityElement(children: .combine)
                if let count = opponent.workoutCount { Text("\(count) workouts").font(.caption2) }
                difference(own)
                if item.lifecycle == .completed, opponent.leader {
                    Label("\(opponent.name) currently leads", systemImage: "trophy").font(.caption)
                }
                if item.lifecycle == .active {
                    Divider()
                    today(own)
                    today(opponent)
                }
            } else {
                if let count = item.participantCount {
                    Text("\(count) participants").font(.caption2).foregroundStyle(.secondary)
                }
                ForEach(item.rows) { row in
                    participant(row)
                }
                if let own = item.ownRow {
                    difference(own)
                    if item.lifecycle == .active { today(own) }
                }
            }
            if let own = item.ownRow, own.dataDays < own.eligibleDays {
                Text("Data on \(own.dataDays) of \(own.eligibleDays) days. Missing days count as zero; they may not have synced.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func difference(_ own: ChallengeParticipant) -> some View {
        if item.lifecycle == .completed, own.leader {
            Label(own.tied ? "Currently tied for first" : "Currently first", systemImage: "trophy")
                .font(.headline)
        } else if own.leader && own.tied {
            Label("Tied for the lead", systemImage: "equal").font(.headline)
        } else if own.leader, let margin = item.leadMargin {
            Label("Ahead by \(ChallengeFormat.score(margin, item: item))", systemImage: "arrow.up")
                .font(.headline).foregroundStyle(.tint)
        } else if let gap = own.gapToLeader, gap > 0 {
            Label("\(ChallengeFormat.score(gap, item: item)) to the lead", systemImage: "arrow.up.right")
                .font(.headline)
        }
    }

    private func participant(_ row: ChallengeParticipant) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                if let rank = row.rank { Text(rank, format: .number).bold().monospacedDigit() }
                Text(row.isSelf ? String(localized: "You") : row.name).font(.headline).lineLimit(2)
                Spacer(minLength: 0)
                if row.leader { Image(systemName: "trophy").accessibilityLabel("Current leader") }
            }
            Text(ChallengeFormat.score(row.total, item: item)).monospacedDigit()
            if let count = row.workoutCount { Text("\(count) workouts").font(.caption2) }
            if row.tied { Text("Tied rank").font(.caption2).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(6)
        .background(row.isSelf ? Color.accentColor.opacity(0.16) : Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(row.isSelf ? String(localized: "You") : row.name), \(ChallengeFormat.rank(row)), \(ChallengeFormat.score(row.total, item: item))")
    }

    @ViewBuilder
    private func today(_ row: ChallengeParticipant) -> some View {
        if let point = row.today {
            VStack(alignment: .leading, spacing: 2) {
                // Use the server bucket, labelled Today only in its Challenge zone.
                // An older bucket stays explicitly dated after midnight.
                Text("\(row.isSelf ? String(localized: "You") : row.name) · \(ChallengeFormat.dayLabel(point.date, timezone: item.timezone))")
                    .font(.caption2).foregroundStyle(.secondary)
                if point.eligible && point.present {
                    Text(ChallengeFormat.score(point.value, item: item)).font(.caption).monospacedDigit()
                } else {
                    Text(point.eligible ? item.noData : "Not started").font(.caption)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        }
    }
}
