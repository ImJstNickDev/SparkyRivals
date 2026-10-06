import Foundation

/// Presentation only. Canonical values and the server's ranks are never changed.
/// Watch and extension resources follow the watch's system language.
enum ChallengePresentationFormat {
    static func number(_ value: Double, decimals: Int = 1, locale: Locale = .autoupdatingCurrent) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = decimals
        formatter.minimumFractionDigits = 0
        if value > 0, value < pow(10, -Double(decimals)) {
            let threshold = formatter.string(from: NSNumber(value: pow(10, -Double(decimals)))) ?? "0.1"
            return String.localizedStringWithFormat(String(localized: "Less than %@"), threshold)
        }
        return formatter.string(from: NSNumber(value: value)) ?? "—"
    }

    static func score(_ value: Double, unit: String, displayUnit: String? = nil) -> String {
        guard value.isFinite, value >= 0 else { return "—" }
        switch unit {
        case "seconds": return ChallengeDurationFormat.string(value)
        case "meters": return measurement(value / (displayUnit == "mi" ? 1609.34 : 1000), unit: displayUnit == "mi" ? UnitLength.miles : UnitLength.kilometers, decimals: 2)
        case "kcal": return measurement(value * (displayUnit == "kJ" ? 4.184 : 1), unit: displayUnit == "kJ" ? UnitEnergy.kilojoules : UnitEnergy.kilocalories, decimals: 1)
        case "milliliters": return measurement(value, unit: UnitVolume.milliliters, decimals: 0)
        case "points": return String.localizedStringWithFormat(String(localized: "%@ pts"), number(value))
        case "goal_days":
            guard value <= 366 else { return "—" }
            return String.localizedStringWithFormat(String(localized: "%lld goal days"), Int64(value))
        default:
            // Steps remain an exact integer within the JS safe-integer boundary,
            // including on arm64_32; never narrow the total to watchOS Int.
            guard value <= 9_007_199_254_740_991 else { return "—" }
            return String.localizedStringWithFormat(String(localized: "%lld steps"), Int64(value))
        }
    }

    static func measurement(_ value: Double, unit: Dimension, decimals: Int) -> String {
        let formatter = MeasurementFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.unitOptions = .providedUnit
        formatter.unitStyle = .short
        formatter.numberFormatter.maximumFractionDigits = decimals
        formatter.numberFormatter.minimumFractionDigits = 0
        if value > 0, value < pow(10, -Double(decimals)) {
            let threshold = formatter.string(from: Measurement(value: pow(10, -Double(decimals)), unit: unit))
            return String.localizedStringWithFormat(String(localized: "Less than %@"), threshold)
        }
        return formatter.string(from: Measurement(value: value, unit: unit))
    }

    static func updated(_ date: Date, now: Date) -> String {
        if now.timeIntervalSince(date) > 7 * 86400 {
            return String.localizedStringWithFormat(String(localized: "Updated %@"), date.formatted(date: .abbreviated, time: .omitted))
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return String.localizedStringWithFormat(String(localized: "Updated %@"), formatter.localizedString(for: date, relativeTo: now))
    }
}
