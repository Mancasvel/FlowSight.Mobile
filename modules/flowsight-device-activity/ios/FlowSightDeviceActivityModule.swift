// FlowSightDeviceActivityModule.swift
//
// iOS native module for Screen Time / Family Controls integration.
//
// IMPORTANT: This module requires the Family Controls entitlement from Apple.
// If the entitlement is not approved, the app must work without it.
// The base app functionality (manual timer, cloud sync) works without this module.
//
// Family Controls provides:
// - Opaque app tokens (NOT app names — Apple policy)
// - Total usage time per app category
// - Number of pickups
// - Notification count
//
// Family Controls does NOT provide:
// - Window titles or content
// - URLs or browsing history
// - Screenshots of other apps
// - Keystrokes or clipboard content
//
// To request the entitlement:
// https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement

import ExpoModulesCore
import FamilyControls
import DeviceActivity

public class FlowSightDeviceActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FlowSightDeviceActivity")

    // Check if Family Controls is available
    AsyncFunction("isAvailable") { () -> Bool in
      return true // Family Controls framework is linked
    }

    // Check authorization status
    AsyncFunction("checkAuthorization") { () -> [String: Any] in
      let center = AuthorizationCenter.shared
      let status = center.authorizationStatus

      return [
        "granted": status == .approved,
        "status": status == .approved ? "approved" :
                  status == .denied ? "denied" : "notDetermined",
        "platform": "ios",
        "method": "family_controls"
      ]
    }

    // Request authorization
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          promise.resolve([
            "granted": true,
            "platform": "ios",
            "method": "family_controls"
          ])
        } catch {
          promise.resolve([
            "granted": false,
            "platform": "ios",
            "method": "family_controls",
            "error": error.localizedDescription
          ])
        }
      }
    }

    // Get device activity data
    // Returns opaque tokens only — no app names per Apple policy
    AsyncFunction("getActivity") { (startDateMs: Double, endDateMs: Double) -> [[String: Any]] in
      // In production, this would use DeviceActivityMonitor
      // to retrieve usage data for the specified time range.
      //
      // The data returned is limited to:
      // - Opaque application tokens
      // - Usage duration
      // - Category tokens
      //
      // App names are NOT available through Family Controls.
      // Tokens must be stored locally and never serialized/shared.
      return []
    }
  }
}
