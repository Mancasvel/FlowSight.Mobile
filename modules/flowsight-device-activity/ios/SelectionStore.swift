import FamilyControls
import Foundation
import ManagedSettings

enum SelectionStore {
  static let key = "flowsight.familyActivitySelection"
  static let suiteName = "group.ai.flowsight.mobile"

  static var defaults: UserDefaults {
    UserDefaults(suiteName: suiteName) ?? .standard
  }

  static func load() -> FamilyActivitySelection? {
    let data = defaults.data(forKey: key) ?? UserDefaults.standard.data(forKey: key)
    guard let data else { return nil }
    if let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
      return selection
    }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  static func save(_ selection: FamilyActivitySelection) {
    guard let data = try? PropertyListEncoder().encode(selection) else { return }
    defaults.set(data, forKey: key)
    UserDefaults.standard.set(data, forKey: key)
  }

  static func hasSelection(_ selection: FamilyActivitySelection? = load()) -> Bool {
    guard let selection else { return false }
    return !selection.applicationTokens.isEmpty
      || !selection.categoryTokens.isEmpty
      || !selection.webDomainTokens.isEmpty
  }

  static func isFocusApp(_ token: ApplicationToken?) -> Bool {
    guard let token, let selection = load() else { return false }
    return selection.applicationTokens.contains(token)
  }
}
