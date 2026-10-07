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
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "trophy").foregroundStyle(.secondary).accessibilityHidden(true)
                Text(entry.snapshot?.title ?? localizedWidgetString("widget.challenge.name"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .font(.system(.caption, design: .rounded).weight(.semibold)).lineLimit(2)
            Spacer(minLength: 0)
            if let value = entry.snapshot {
                if value.score.isEmpty {
                    Text(value.metric).font(.subheadline).lineLimit(2)
                } else if family == .systemMedium {
                    HStack(alignment: .firstTextBaseline, spacing: 16) {
                        score(value.score).frame(maxWidth: .infinity, alignment: .leading)
                        Text(value.rank).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                    }
                } else {
                    score(value.score)
                    Text(value.rank).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 0)
                let age = entry.date.timeIntervalSince1970 - value.generatedAt / 1000
                // Keep the source timestamp. Old results replace the ordinary footer
                // with the stale warning rather than adding another line of copy.
                Text(age > 900 || age < -300 ? value.staleLabel : value.status)
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(2)
            } else {
                Text(localizedWidgetString("widget.challenge.not_synced")).font(.caption).foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .privacySensitive()
        .widgetURL(entry.snapshot?.link ?? hostAppURL("challenges"))
        .containerBackground(.fill.tertiary, for: .widget)
        .accessibilityElement(children: .combine)
    }

    private func score(_ text: String) -> some View {
        Text(text).font(.system(.title3, design: .rounded).weight(.semibold))
            .lineLimit(2).fixedSize(horizontal: false, vertical: true)
    }
}
struct ChallengeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "challengeWidget", provider: ChallengeWidgetProvider()) { ChallengeWidgetView(entry: $0) }
            .configurationDisplayName(Text(verbatim: localizedWidgetString("widget.challenge.name")))
            .description(Text(verbatim: localizedWidgetString("widget.challenge.description")))
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
