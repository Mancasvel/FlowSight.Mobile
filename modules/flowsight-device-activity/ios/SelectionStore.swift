import FamilyControls
import Foundation

enum SelectionStore {
  static let key = "flowsight.familyActivitySelection"

  static func load() -> FamilyActivitySelection? {
    guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
    if let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) {
      return selection
    }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  static func save(_ selection: FamilyActivitySelection) {
    if let data = try? PropertyListEncoder().encode(selection) {
      UserDefaults.standard.set(data, forKey: key)
    }
  }

  static func hasSelection(_ selection: FamilyActivitySelection? = load()) -> Bool {
    guard let selection else { return false }
    return !selection.applicationTokens.isEmpty
      || !selection.categoryTokens.isEmpty
      || !selection.webDomainTokens.isEmpty
  }
}
