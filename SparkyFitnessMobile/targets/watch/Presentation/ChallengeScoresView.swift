import SwiftUI

struct ChallengeScoresView: View {
    let item: WatchChallenge

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let own = item.ownRow {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your total").font(.caption).foregroundStyle(.secondary)
                    Text(own.dataDays > 0 ? item.formattedScore(own.total) : item.noData)
                        .font(.system(.title2, design: .rounded, weight: .bold))
                        .monospacedDigit().fixedSize(horizontal: false, vertical: true)
                    Text(ChallengeFormat.rank(own)).font(.caption)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            }
            Divider()
            // Keep the server's bounded top rows plus self and its exact ranks.
            ForEach(item.rows) { row in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        if let rank = row.rank { Text(rank, format: .number).monospacedDigit().foregroundStyle(.secondary) }
                        Text(row.isSelf ? String(localized: "You") : row.name)
                            .font(.headline).fixedSize(horizontal: false, vertical: true)
                    }
                    Text(row.dataDays > 0 ? item.formattedScore(row.total) : item.noData)
                        .font(.caption).monospacedDigit().fixedSize(horizontal: false, vertical: true)
                    if row.tied { Text("Tied").font(.caption2).foregroundStyle(.secondary) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            }
            if let own = item.ownRow, let point = own.today, item.lifecycle == .active {
                Divider()
                VStack(alignment: .leading, spacing: 3) {
                    Text(ChallengeFormat.dayLabel(point.date, timezone: item.timezone))
                        .font(.caption2).foregroundStyle(.secondary)
                    if point.eligible && point.present {
                        Text(item.formattedScore(point.value)).font(.caption).monospacedDigit()
                    } else {
                        Text(point.eligible ? item.noData : String(localized: "Not started")).font(.caption)
                    }
                }
                .accessibilityElement(children: .combine)
            }
            if let own = item.ownRow, own.dataDays < own.eligibleDays {
                Text("Some days have no data yet.").font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
}
