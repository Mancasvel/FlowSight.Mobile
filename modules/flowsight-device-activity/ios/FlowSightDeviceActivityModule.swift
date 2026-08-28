import DeviceActivity
import ExpoModulesCore
import FamilyControls
import Foundation
import SwiftUI
import UIKit

public class FlowSightDeviceActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FlowSightDeviceActivity")

    AsyncFunction("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("checkAuthorization") { () -> [String: Any] in
      let status = AuthorizationCenter.shared.authorizationStatus
      return [
        "granted": status == .approved,
        "status": Self.statusName(status),
        "platform": "ios",
        "method": "family_controls",
      ]
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          let status = AuthorizationCenter.shared.authorizationStatus
          promise.resolve([
            "granted": status == .approved,
            "status": Self.statusName(status),
            "platform": "ios",
            "method": "family_controls",
          ])
        } catch {
          promise.resolve([
            "granted": false,
            "status": "denied",
            "platform": "ios",
            "method": "family_controls",
            "error": error.localizedDescription,
          ])
        }
      }
    }

    AsyncFunction("hasSelection") { () -> Bool in
      SelectionStore.hasSelection()
    }

    AsyncFunction("presentActivityPicker") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let presenter = Self.topViewController() else {
          promise.resolve(["saved": false, "error": "No view controller available"])
          return
        }

        let holder = PickerCompletion(promise: promise)
        let screen = FamilyActivityPickerScreen(
          selection: SelectionStore.load() ?? FamilyActivitySelection(),
          onSave: { selection in
            guard holder.complete() else { return }
            SelectionStore.save(selection)
            presenter.dismiss(animated: true) {
              promise.resolve([
                "saved": true,
                "applicationCount": selection.applicationTokens.count,
                "categoryCount": selection.categoryTokens.count,
                "webDomainCount": selection.webDomainTokens.count,
              ])
            }
          },
          onCancel: {
            guard holder.complete() else { return }
            presenter.dismiss(animated: true) {
              promise.resolve(["saved": false])
            }
          }
        )

        let host = UIHostingController(rootView: screen)
        host.modalPresentationStyle = .formSheet
        presenter.present(host, animated: true)
      }
    }

    AsyncFunction("startSessionMonitoring") { () -> [String: Any] in
      let startMs = Date().timeIntervalSince1970 * 1000
      let defaults = UserDefaults.standard
      defaults.set(startMs, forKey: SessionKeys.startMs)
      defaults.removeObject(forKey: SessionKeys.endMs)

      let name = DeviceActivityName(SessionKeys.activityName)
      let center = DeviceActivityCenter()
      try? center.stopMonitoring([name])

      let calendar = Calendar.current
      let now = Date()
      let startComponents = calendar.dateComponents([.hour, .minute, .second], from: now)
      let endDate = now.addingTimeInterval(8 * 60 * 60)
      let endComponents = calendar.dateComponents([.hour, .minute, .second], from: endDate)
      let schedule = DeviceActivitySchedule(
        intervalStart: startComponents,
        intervalEnd: endComponents,
        repeats: false
      )

      do {
        if let selection = SelectionStore.load(), SelectionStore.hasSelection(selection) {
          let event = DeviceActivityEvent(
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens,
            threshold: DateComponents(minute: 1)
          )
          try center.startMonitoring(
            name,
            during: schedule,
            events: [DeviceActivityEvent.Name(SessionKeys.eventName): event]
          )
        } else {
          try center.startMonitoring(name, during: schedule)
        }
        return ["started": true, "startMs": startMs]
      } catch {
        return [
          "started": false,
          "startMs": startMs,
          "error": error.localizedDescription,
        ]
      }
    }

    AsyncFunction("stopSessionMonitoring") { () -> [String: Any] in
      let endMs = Date().timeIntervalSince1970 * 1000
      let defaults = UserDefaults.standard
      let startMs = defaults.double(forKey: SessionKeys.startMs)

      try? DeviceActivityCenter().stopMonitoring([DeviceActivityName(SessionKeys.activityName)])

      guard startMs > 0 else {
        return ["stopped": true, "startMs": 0, "endMs": endMs]
      }

      defaults.set(startMs, forKey: SessionKeys.lastStartMs)
      defaults.set(endMs, forKey: SessionKeys.lastEndMs)
      defaults.set(endMs, forKey: SessionKeys.endMs)

      return [
        "stopped": true,
        "startMs": startMs,
        "endMs": endMs,
      ]
    }

    AsyncFunction("getLastSessionWindow") { () -> [String: Any]? in
      let defaults = UserDefaults.standard
      let startMs = defaults.double(forKey: SessionKeys.lastStartMs)
      let endMs = defaults.double(forKey: SessionKeys.lastEndMs)
      if startMs <= 0 || endMs <= 0 {
        return nil
      }
      return ["startMs": startMs, "endMs": endMs]
    }

    AsyncFunction("getActivity") { (_ startDateMs: Double, _ endDateMs: Double) -> [[String: Any]] in
      []
    }

    AsyncFunction("getTrackingStatus") { () -> [String: Any] in
      let defaults = UserDefaults.standard
      let startMs = defaults.double(forKey: SessionKeys.startMs)
      let endMs = defaults.double(forKey: SessionKeys.endMs)
      return [
        "isTracking": startMs > 0 && endMs <= 0,
        "platform": "ios",
        "method": "family_controls",
      ]
    }

    View(FlowSightDeviceActivityReportView.self) {
      Prop("startMs") { (view: FlowSightDeviceActivityReportView, value: Double) in
        view.startMs = value
      }
      Prop("endMs") { (view: FlowSightDeviceActivityReportView, value: Double) in
        view.endMs = value
      }
      Prop("segment") { (view: FlowSightDeviceActivityReportView, value: String) in
        view.segment = value
      }
    }
  }

  private static func statusName(_ status: AuthorizationStatus) -> String {
    switch status {
    case .approved: return "approved"
    case .denied: return "denied"
    default: return "notDetermined"
    }
  }

  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow } ?? scenes.first?.windows.first
    var controller = window?.rootViewController
    while let presented = controller?.presentedViewController {
      controller = presented
    }
    return controller
  }
}

private enum SessionKeys {
  static let startMs = "flowsight.sessionStartMs"
  static let endMs = "flowsight.sessionEndMs"
  static let lastStartMs = "flowsight.lastSessionStartMs"
  static let lastEndMs = "flowsight.lastSessionEndMs"
  static let activityName = "flowsight.session"
  static let eventName = "flowsight.oneMinute"
}

private final class PickerCompletion {
  private var resolved = false
  let promise: Promise

  init(promise: Promise) {
    self.promise = promise
  }

  func complete() -> Bool {
    if resolved { return false }
    resolved = true
    return true
  }
}

private struct FamilyActivityPickerScreen: View {
  @State var selection: FamilyActivitySelection
  var onSave: (FamilyActivitySelection) -> Void
  var onCancel: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Apps to measure")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Save") { onSave(selection) }
          }
        }
    }
    .navigationViewStyle(.stack)
  }
}
