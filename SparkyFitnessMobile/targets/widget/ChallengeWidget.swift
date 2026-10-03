import WidgetKit
import SwiftUI

private struct ChallengeWidgetSnapshot: Decodable {
    let version: Int
    let state: String
    let accountKey: String
    let generatedAt: Double
    let title: String
    let metric: String
    let status: String
    let score: String
    let rank: String
    let gap: String
    let peer: String
    let url: String
    let staleLabel: String

    static func load() -> Self? {
        guard let group = appGroupIdentifier(),
              let data = UserDefaults(suiteName: group)?.data(forKey: "challengeWidgetSnapshot"),
              let value = try? JSONDecoder().decode(Self.self, from: data),
              value.version == 1, value.state == "ready", !value.accountKey.isEmpty else { return nil }
        return value
    }
    var link: URL? {
        guard let parsed = URL(string: url), parsed.scheme == hostAppURL()?.scheme,
              parsed.host == "challenges" else { return hostAppURL("challenges") }
        return parsed
    }
}
private struct ChallengeWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: ChallengeWidgetSnapshot?
}
private struct ChallengeWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChallengeWidgetEntry { .init(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (ChallengeWidgetEntry) -> Void) {
        completion(.init(date: Date(), snapshot: .load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChallengeWidgetEntry>) -> Void) {
        let now = Date()
        let snapshot = ChallengeWidgetSnapshot.load()
        // Schedule the stale transition with the same source time, never a new verification.
        let staleAt = snapshot.map { Date(timeIntervalSince1970: $0.generatedAt / 1000 + 901) }
        var entries = [ChallengeWidgetEntry(date: now, snapshot: snapshot)]
        if let staleAt, staleAt > now { entries.append(.init(date: staleAt, snapshot: snapshot)) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(900))))
    }
}
private struct ChallengeWidgetView: View {
    let entry: ChallengeWidgetEntry
    @Environment(\.widgetFamily) private var family
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Label(entry.snapshot?.title ?? localizedWidgetString("widget.challenge.name"), systemImage: "trophy")
                .font(.caption.bold()).lineLimit(1)
            if let value = entry.snapshot {
                Text(value.status).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                Text(value.score).font(.system(.title2, design: .rounded).bold()).minimumScaleFactor(0.6).lineLimit(1)
                Text(value.rank).font(.caption)
                Text(value.gap).font(.caption.bold()).lineLimit(1)
                if family == .systemMedium { Text(value.peer).font(.caption).lineLimit(1) }
                let age = entry.date.timeIntervalSince1970 - value.generatedAt / 1000
                if age > 900 || age < -300 { Text(value.staleLabel).font(.caption2).foregroundStyle(.secondary) }
            } else {
                Text(localizedWidgetString("widget.challenge.not_synced")).font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .privacySensitive()
        .widgetURL(entry.snapshot?.link ?? hostAppURL("challenges"))
        .containerBackground(.fill.tertiary, for: .widget)
        .accessibilityElement(children: .combine)
    }
}
struct ChallengeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "challengeWidget", provider: ChallengeWidgetProvider()) { ChallengeWidgetView(entry: $0) }
            .configurationDisplayName("widget.challenge.name")
            .description("widget.challenge.description")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
