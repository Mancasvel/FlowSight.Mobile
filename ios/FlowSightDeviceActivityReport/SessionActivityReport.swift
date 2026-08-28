import DeviceActivity
import FamilyControls
import ManagedSettings
import ManagedSettingsUI
import SwiftUI

struct AppUsage: Identifiable {
  let id: String
  let token: ApplicationToken?
  let duration: TimeInterval
}

struct SessionConfiguration {
  var apps: [AppUsage]
  var total: TimeInterval
}

struct SessionActivityReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("FlowSightSessionApps")
  let content: (SessionConfiguration) -> SessionActivityView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> SessionConfiguration {
    var totals: [String: (token: ApplicationToken?, duration: TimeInterval)] = [:]

    for await device in data {
      for await segment in device.activitySegments {
        for await category in segment.categories {
          for await app in category.applications {
            let key = String(describing: app.application.token)
            let previous = totals[key]?.duration ?? 0
            totals[key] = (app.application.token, previous + app.totalActivityDuration)
          }
        }
      }
    }

    let apps = totals
      .map { AppUsage(id: $0.key, token: $0.value.token, duration: $0.value.duration) }
      .filter { $0.duration > 0 }
      .sorted { $0.duration > $1.duration }

    return SessionConfiguration(
      apps: apps,
      total: apps.reduce(0) { $0 + $1.duration }
    )
  }
}

struct SessionActivityView: View {
  let configuration: SessionConfiguration

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if configuration.apps.isEmpty {
        Text("No Screen Time in this window yet. Grant Screen Time, pick apps if asked, then wait a minute.")
          .font(.footnote)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, alignment: .center)
          .padding(.vertical, 28)
      } else {
        ForEach(Array(configuration.apps.prefix(12))) { app in
          HStack(spacing: 12) {
            if let token = app.token {
              Label(token)
                .labelStyle(.titleAndIcon)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
              Text("App")
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(Self.formatDuration(app.duration))
              .font(.footnote.monospacedDigit().weight(.semibold))
              .foregroundStyle(.secondary)
          }
        }
      }
    }
    .padding(.horizontal, 4)
    .preferredColorScheme(.dark)
  }

  private static func formatDuration(_ interval: TimeInterval) -> String {
    let total = Int(interval.rounded())
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let seconds = total % 60
    if hours > 0 { return String(format: "%dh %02dm", hours, minutes) }
    if minutes > 0 { return String(format: "%dm %02ds", minutes, seconds) }
    return String(format: "%ds", seconds)
  }
}
