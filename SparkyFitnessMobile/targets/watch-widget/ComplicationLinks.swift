import Foundation

/// The URLs complications hand back to the watch app when tapped, so each one
/// opens the page it is about.
///
/// The application identity resolver writes WATCH_URL_SCHEME into both targets'
/// Info.plist files. Keep destination cases aligned with the companion target.
enum ComplicationLink: String {
    /// Daily Energy Goal → the Goals summary page.
    case goals
    /// Water intake → the Water page. Used by `WaterGoalComplication`.
    case water

    static let scheme = Bundle.main.object(forInfoDictionaryKey: "WATCH_URL_SCHEME") as? String ?? ""

    var url: URL? { URL(string: "\(Self.scheme)://\(rawValue)") }
}
