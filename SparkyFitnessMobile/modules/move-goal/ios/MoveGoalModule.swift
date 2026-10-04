import ExpoModulesCore
import HealthKit

/// Explicit phone-side import only. No observer, health writes or Watch sender.
public class MoveGoalModule: Module {
    private let store = HKHealthStore()

    public func definition() -> ModuleDefinition {
        Name("MoveGoal")
        AsyncFunction("requestAndReadCurrentMoveGoal") { (promise: Promise) in
            guard HKHealthStore.isHealthDataAvailable() else {
                promise.resolve(nil as Double?)
                return
            }
            self.store.requestAuthorization(toShare: [], read: [HKObjectType.activitySummaryType()]) { success, _ in
                guard success else { promise.resolve(nil as Double?); return }
                let calendar = Calendar.current
                var date = calendar.dateComponents([.era, .year, .month, .day], from: Date())
                date.calendar = calendar
                let query = HKActivitySummaryQuery(predicate: HKQuery.predicateForActivitySummary(with: date)) { _, summaries, _ in
                    // Read authorization is deliberately opaque in HealthKit.
                    // No summary can mean unavailable data or permission denial.
                    guard let summary = summaries?.first, summary.activityMoveMode == .activeEnergy else {
                        promise.resolve(nil as Double?)
                        return
                    }
                    let kcal = summary.activeEnergyBurnedGoal.doubleValue(for: .kilocalorie())
                    promise.resolve(kcal.isFinite && kcal > 0 ? kcal : nil)
                }
                self.store.execute(query)
            }
        }
    }
}
