import WidgetKit
import SwiftUI
import AppIntents

struct ChallengeWidgetSnapshot: Decodable {
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
    let selectionId: String?
    let choices: [ChallengeWidgetSnapshot]?
    let neighbors: [ChallengeWidgetNeighbor]?

    func selected(_ id: String?) -> Self? {
        guard let id, id != "automatic" else { return self }
        // The opaque choice includes the account binding, not just a Challenge ID.
        return choices?.first { $0.selectionId == id && $0.accountKey == accountKey }
    }

    static func load() -> Self? {
        guard let group = appGroupIdentifier(),
              let defaults = UserDefaults(suiteName: group),
              let data = defaults.string(forKey: "challengeWidgetSnapshot")?.data(using: .utf8)
                ?? defaults.data(forKey: "challengeWidgetSnapshot"),
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
    var pinned = false
}
struct ChallengeWidgetNeighbor: Decodable {
    let slot: String
    let name: String
    let score: String
    let rank: String
}

struct ChallengeWidgetChoice: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: LocalizedStringResource("widget.challenge.choose", defaultValue: "Challenge"))
    static var defaultQuery = ChallengeWidgetChoiceQuery()
    let id: String
    var displayRepresentation: DisplayRepresentation {
        let title = id == "automatic" ? localizedWidgetString("widget.challenge.automatic")
            : ChallengeWidgetSnapshot.load()?.selected(id)?.title ?? localizedWidgetString("widget.challenge.unavailable")
        return DisplayRepresentation(title: "\(title)")
    }
}
struct ChallengeWidgetChoiceQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [ChallengeWidgetChoice] {
        // Keep an obsolete selection unresolved on screen; never silently replace
        // it with another account's automatic Challenge.
        identifiers.map { ChallengeWidgetChoice(id: $0) }
    }
    func suggestedEntities() async throws -> [ChallengeWidgetChoice] {
        [ChallengeWidgetChoice(id: "automatic")] + (ChallengeWidgetSnapshot.load()?.choices ?? [])
            .compactMap { $0.selectionId.map { ChallengeWidgetChoice(id: $0) } }
    }
    func defaultResult() async -> ChallengeWidgetChoice? { .init(id: "automatic") }
}
struct ChallengeWidgetIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = LocalizedStringResource("widget.challenge.choose", defaultValue: "Challenge")
    static var description = IntentDescription(LocalizedStringResource("widget.challenge.synced_choices", defaultValue: "Choose from up to eight recently synced Challenges. Open the app to refresh."))
    @Parameter(title: LocalizedStringResource("widget.challenge.choose", defaultValue: "Challenge"))
    var challenge: ChallengeWidgetChoice?
}
private struct ChallengeWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ChallengeWidgetEntry { .init(date: Date(), snapshot: nil) }
    func snapshot(for configuration: ChallengeWidgetIntent, in context: Context) async -> ChallengeWidgetEntry {
        .init(date: Date(), snapshot: ChallengeWidgetSnapshot.load()?.selected(configuration.challenge?.id), pinned: configuration.challenge?.id != nil && configuration.challenge?.id != "automatic")
    }
    func timeline(for configuration: ChallengeWidgetIntent, in context: Context) async -> Timeline<ChallengeWidgetEntry> {
        let now = Date()
        let snapshot = ChallengeWidgetSnapshot.load()?.selected(configuration.challenge?.id)
        // Schedule the stale transition with the same source time, never a new verification.
        let staleAt = snapshot.map { Date(timeIntervalSince1970: $0.generatedAt / 1000 + 901) }
        var entries = [ChallengeWidgetEntry(date: now, snapshot: snapshot, pinned: configuration.challenge?.id != nil && configuration.challenge?.id != "automatic")]
        if let staleAt, staleAt > now { entries.append(.init(date: staleAt, snapshot: snapshot)) }
        return Timeline(entries: entries, policy: .after(now.addingTimeInterval(900)))
    }
}
private struct ChallengeWidgetView: View {
    let entry: ChallengeWidgetEntry
    @Environment(\.widgetFamily) private var family
    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemMedium ? 4 : 8) {
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
                } else if family == .systemMedium, let neighbors = value.neighbors, !neighbors.isEmpty {
                    Text(value.rank).font(.system(.subheadline, design: .rounded).weight(.semibold))
                    VStack(spacing: 3) {
                        ForEach(["above", "self", "below"], id: \.self) { slot in
                            if let row = neighbors.first(where: { $0.slot == slot }) {
                                HStack(spacing: 8) {
                                    Text(row.rank).monospacedDigit().frame(minWidth: 16, alignment: .trailing)
                                    Text(row.name).frame(maxWidth: .infinity, alignment: .leading)
                                    Text(row.score).monospacedDigit().layoutPriority(1)
                                }
                                .font(.system(.caption, design: .rounded).weight(slot == "self" ? .semibold : .regular))
                                .foregroundStyle(slot == "self" ? Color.primary : Color.secondary)
                                .lineLimit(1)
                            } else {
                                Color.clear.frame(height: 15).accessibilityHidden(true)
                            }
                        }
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
                Text(entry.pinned ? localizedWidgetString("widget.challenge.unavailable") : localizedWidgetString("widget.challenge.not_synced")).font(.caption).foregroundStyle(.secondary)
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
        AppIntentConfiguration(kind: "challengeWidget", intent: ChallengeWidgetIntent.self, provider: ChallengeWidgetProvider()) { ChallengeWidgetView(entry: $0) }
            .configurationDisplayName(Text(verbatim: localizedWidgetString("widget.challenge.name")))
            .description(Text(verbatim: localizedWidgetString("widget.challenge.description")))
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
