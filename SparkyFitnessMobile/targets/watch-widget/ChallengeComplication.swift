import WidgetKit
import SwiftUI

/// Matches the narrow ChallengeSurfaceSnapshot writer in the Watch app target.
private struct ChallengeComplicationSnapshot: Decodable {
    let version: Int
    let accountKey: String
    let generatedAt: Double
    let title: String
    let score: String
    let metric: String?
    let rank: String
    let status: String
    static func load() -> Self? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "APP_GROUP_IDENTIFIER") as? String,
              let data = UserDefaults(suiteName: group)?.data(forKey: "challengeComplicationSnapshot"),
              let value = try? JSONDecoder().decode(Self.self, from: data), value.version == 1,
              !value.accountKey.isEmpty else { return nil }
        return value
    }
}
private struct ChallengeComplicationEntry: TimelineEntry {
    let date: Date
    let snapshot: ChallengeComplicationSnapshot?
}
private struct ChallengeComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChallengeComplicationEntry { .init(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (ChallengeComplicationEntry) -> Void) { completion(.init(date: Date(), snapshot: .load())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChallengeComplicationEntry>) -> Void) {
        let now = Date()
        let value = ChallengeComplicationSnapshot.load()
        var entries = [ChallengeComplicationEntry(date: now, snapshot: value)]
        if let value {
            let staleAt = Date(timeIntervalSince1970: value.generatedAt + 901)
            if staleAt > now { entries.append(.init(date: staleAt, snapshot: value)) }
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(900))))
    }
}
private struct ChallengeComplicationView: View {
    let entry: ChallengeComplicationEntry
    @Environment(\.widgetFamily) private var family
    private var stale: Bool {
        guard let value = entry.snapshot else { return false }
        let age = entry.date.timeIntervalSince1970 - value.generatedAt
        return age > 900 || age < -300
    }
    var body: some View {
        Group {
            if let value = entry.snapshot {
                switch family {
                case .accessoryInline:
                    Text(value.rank.isEmpty ? value.status : "\(stale ? "↻ " : "")\(value.rank) · \(value.score)")
                case .accessoryCircular:
                    VStack(spacing: 1) { Image(systemName: stale ? "clock" : "trophy"); if value.rank.isEmpty { Text(value.status).font(.caption2).lineLimit(2) } else { Text(value.rank).font(.caption2).lineLimit(2) } }
                default:
                    VStack(alignment: .leading, spacing: 1) {
                        Text(value.title).font(.headline).lineLimit(1)
                        Text("\(value.rank) · \(value.score)").font(.caption).lineLimit(1)
                        Text(stale ? String(localized: "May be out of date") : value.status).font(.caption2).lineLimit(1)
                    }
                }
            } else { Label("Open iPhone to sync", systemImage: "trophy").font(.caption2) }
        }
        .privacySensitive()
        .widgetURL(ComplicationLink.challenge.url)
        .containerBackground(.clear, for: .widget)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(entry.snapshot.map { "\($0.title), \($0.rank), \($0.score), \($0.status)" } ?? String(localized: "Challenges not synced yet"))
        .accessibilityHint(stale ? String(localized: "May be out of date") : "")
    }
}
struct ChallengeComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "challengeComplication", provider: ChallengeComplicationProvider()) { ChallengeComplicationView(entry: $0) }
            .configurationDisplayName("Challenges")
            .description("Your latest Challenge position.")
            .supportedFamilies([.accessoryInline, .accessoryCircular, .accessoryRectangular])
    }
}
