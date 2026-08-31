import DeviceActivity
import FamilyControls
import ManagedSettings
import ManagedSettingsUI
import SwiftUI

private enum SharedSelection {
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

  static func isFocusApp(_ token: ApplicationToken?) -> Bool {
    guard let token, let selection = load() else { return false }
    return selection.applicationTokens.contains(token)
  }
}

private enum UsageSnapshotStore {
  static let key = "flowsight.usageSnapshot"

  static func write(hours: [HourRow]) {
    let calendar = Calendar.current
    let payload: [String: Any] = [
      "capturedAtMs": Date().timeIntervalSince1970 * 1000,
      "hours": hours.map { hour -> [String: Any] in
        [
          "startMs": hour.start.timeIntervalSince1970 * 1000,
          "hour": calendar.component(.hour, from: hour.start),
          "apps": hour.apps.map { app -> [String: Any] in
            var row: [String: Any] = [
              "id": app.id,
              "name": app.name,
              "seconds": app.duration,
              "isFocus": app.isFocus,
            ]
            if let bundleId = app.bundleId {
              row["bundleId"] = bundleId
            }
            return row
          },
        ]
      },
    ]
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8)
    else { return }
    SharedSelection.defaults.set(json, forKey: key)
  }
}

private func applicationKey(_ token: ApplicationToken?) -> String {
  guard let token, let data = try? PropertyListEncoder().encode(token) else {
    return "unknown"
  }
  return data.base64EncodedString()
}

private func applicationLabel(_ application: Application, isFocus: Bool) -> String {
  let display = application.localizedDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  if !display.isEmpty { return display }
  if let bundle = application.bundleIdentifier, !bundle.isEmpty {
    if let last = bundle.split(separator: ".").last {
      return last.replacingOccurrences(of: "-", with: " ").capitalized
    }
    return bundle
  }
  return isFocus ? "Focus app" : "Other app"
}

struct AppUsage: Identifiable {
  let id: String
  let token: ApplicationToken?
  let name: String
  let bundleId: String?
  let duration: TimeInterval
  let isFocus: Bool
}

struct HourRow: Identifiable {
  let id: Date
  let start: Date
  let focus: TimeInterval
  let switching: TimeInterval
  let switches: Int
  let apps: [AppUsage]
}

struct SessionConfiguration {
  var hours: [HourRow]
  var focusTotal: TimeInterval
  var switchingTotal: TimeInterval
  var switches: Int
  var apps: [AppUsage]
}

struct SessionActivityReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("FlowSightSessionApps")
  let content: (SessionConfiguration) -> SessionActivityView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> SessionConfiguration {
    var hours: [HourRow] = []
    var appTotals: [String: AppUsage] = [:]

    for await device in data {
      for await segment in device.activitySegments {
        var hourApps: [String: AppUsage] = [:]
        var activity: TimeInterval = 0

        for await category in segment.categories {
          for await app in category.applications {
            let token = app.application.token
            let key = applicationKey(token)
            let isFocus = SharedSelection.isFocusApp(token)
            let name = applicationLabel(app.application, isFocus: isFocus)
            let bundleId = app.application.bundleIdentifier
            let previous = hourApps[key]?.duration ?? 0
            let usage = AppUsage(
              id: key,
              token: token,
              name: name,
              bundleId: bundleId,
              duration: previous + app.totalActivityDuration,
              isFocus: isFocus
            )
            hourApps[key] = usage
            activity += app.totalActivityDuration

            let totalPrevious = appTotals[key]?.duration ?? 0
            appTotals[key] = AppUsage(
              id: key,
              token: token,
              name: name,
              bundleId: bundleId,
              duration: totalPrevious + app.totalActivityDuration,
              isFocus: isFocus
            )
          }
        }

        let interval = segment.dateInterval.duration
        let idle = max(0, interval - activity)
        let focusApps = hourApps.values.reduce(0.0) { $0 + ($1.isFocus ? $1.duration : 0) }
        let switching = hourApps.values.reduce(0.0) { $0 + ($1.isFocus ? 0 : $1.duration) }
        let apps = hourApps.values
          .filter { $0.duration > 0 }
          .sorted { $0.duration > $1.duration }

        hours.append(
          HourRow(
            id: segment.dateInterval.start,
            start: segment.dateInterval.start,
            focus: idle + focusApps,
            switching: switching,
            switches: apps.filter { !$0.isFocus }.count,
            apps: apps
          )
        )
      }
    }

    hours.sort { $0.start < $1.start }
    let apps = appTotals.values
      .filter { $0.duration > 0 }
      .sorted { $0.duration > $1.duration }

    UsageSnapshotStore.write(hours: hours)

    return SessionConfiguration(
      hours: hours,
      focusTotal: hours.reduce(0) { $0 + $1.focus },
      switchingTotal: hours.reduce(0) { $0 + $1.switching },
      switches: hours.reduce(0) { $0 + $1.switches },
      apps: apps
    )
  }
}

private let focusColor = Color(red: 0.00, green: 0.72, blue: 0.66)
private let switchingColor = Color(red: 0.96, green: 0.62, blue: 0.04)

struct SessionActivityView: View {
  let configuration: SessionConfiguration

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if configuration.apps.isEmpty {
        Text("No apps in this window yet. Start a block and wait a minute.")
          .font(.footnote)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.vertical, 12)
      } else {
        appList
      }
    }
    .padding(.horizontal, 2)
    .padding(.bottom, 4)
  }

  private var chartHours: [HourRow] {
    paddedHours(configuration.hours)
  }

  private var summary: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 2) {
        Text("SCREEN TIME")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(Self.formatDuration(configuration.focusTotal + configuration.switchingTotal))
          .font(.title3.monospacedDigit().weight(.semibold))
      }
      Spacer()
      HStack(spacing: 12) {
        legendDot(color: focusColor, title: "Focus")
        legendDot(color: switchingColor, title: "Switch")
      }
    }
  }

  private var hourlyChart: some View {
    let hours = chartHours
    let maxTotal = max(hours.map { $0.focus + $0.switching }.max() ?? 1, 1)
    let chartHeight: CGFloat = 132
    let labelEvery = hours.count > 12 ? 3 : hours.count > 8 ? 2 : 1

    return VStack(spacing: 8) {
      HStack(alignment: .bottom, spacing: 3) {
        ForEach(Array(hours.enumerated()), id: \.element.id) { _, hour in
          let total = hour.focus + hour.switching
          let height = total <= 0 ? 3 : max(CGFloat(total / maxTotal) * chartHeight, 8)
          let focusShare = total <= 0 ? 1 : hour.focus / total

          VStack(spacing: 0) {
            Spacer(minLength: 0)
            VStack(spacing: 0) {
              if hour.apps.isEmpty || total <= 0 {
                Rectangle()
                  .fill(switchingColor)
                  .frame(height: height * (1 - focusShare))
                Rectangle()
                  .fill(focusColor)
                  .frame(height: height * focusShare)
              } else {
                ForEach(hour.apps.sorted { $0.duration < $1.duration }) { app in
                  Rectangle()
                    .fill(appColor(app.name))
                    .frame(height: height * CGFloat(app.duration / total))
                }
              }
            }
            .frame(height: height, alignment: .bottom)
            .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
          }
          .frame(maxWidth: .infinity)
          .frame(height: chartHeight, alignment: .bottom)
        }
      }

      HStack(spacing: 3) {
        ForEach(Array(hours.enumerated()), id: \.element.id) { index, hour in
          Text(index % labelEvery == 0 ? hourLabel(hour.start) : "")
            .font(.system(size: 8, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .lineLimit(1)
        }
      }
    }
  }

  private var appList: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(configuration.apps.prefix(8)) { app in
        HStack(spacing: 8) {
          Circle()
            .fill(app.isFocus ? focusColor : switchingColor)
            .frame(width: 6, height: 6)
          if let token = app.token {
            Label(token)
              .labelStyle(.titleAndIcon)
              .lineLimit(1)
              .frame(maxWidth: .infinity, alignment: .leading)
          } else {
            Text(app.isFocus ? "Focus app" : "Other app")
              .frame(maxWidth: .infinity, alignment: .leading)
          }
          Text(Self.formatDuration(app.duration))
            .font(.caption.monospacedDigit().weight(.semibold))
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  private func legendDot(color: Color, title: String) -> some View {
    HStack(spacing: 4) {
      Circle().fill(color).frame(width: 7, height: 7)
      Text(title)
        .font(.caption2.weight(.medium))
        .foregroundStyle(.secondary)
    }
  }

  private func paddedHours(_ hours: [HourRow]) -> [HourRow] {
    let calendar = Calendar.current
    let now = Date()
    let anchor = hours.first?.start ?? now
    let dayStart = calendar.startOfDay(for: anchor)

    func hourOf(_ date: Date) -> Int {
      calendar.component(.hour, from: date)
    }

    func emptyRow(_ hour: Int) -> HourRow {
      let date = calendar.date(byAdding: .hour, value: hour, to: dayStart) ?? dayStart
      return HourRow(id: date, start: date, focus: 0, switching: 0, switches: 0, apps: [])
    }

    var map: [Int: HourRow] = [:]
    for hour in hours {
      map[hourOf(hour.start)] = hour
    }

    func row(forHour hour: Int) -> HourRow {
      map[hour] ?? emptyRow(hour)
    }

    let fullDay = (0..<24).map(row(forHour:))
    let usedHours = hours.filter { $0.focus + $0.switching > 0 }.map { hourOf($0.start) }
    if let minH = usedHours.min(), let maxH = usedHours.max(), maxH - minH >= 8 {
      return fullDay
    }

    let center: Int
    if let peak = hours.max(by: { ($0.focus + $0.switching) < ($1.focus + $1.switching) }),
       peak.focus + peak.switching > 0 {
      center = hourOf(peak.start)
    } else {
      center = hourOf(now)
    }
    let start = max(0, min(16, center - 3))
    return Array(fullDay[start..<(start + 8)])
  }

  private func appColor(_ name: String) -> Color {
    let palette: [Color] = [
      Color(red: 0.00, green: 0.72, blue: 0.66),
      Color(red: 0.39, green: 0.40, blue: 0.95),
      Color(red: 0.96, green: 0.62, blue: 0.04),
      Color(red: 0.93, green: 0.28, blue: 0.60),
      Color(red: 0.22, green: 0.74, blue: 0.97),
      Color(red: 0.06, green: 0.73, blue: 0.51),
      Color(red: 0.98, green: 0.45, blue: 0.09),
      Color(red: 0.66, green: 0.33, blue: 0.97),
      Color(red: 0.05, green: 0.65, blue: 0.91),
      Color(red: 0.94, green: 0.27, blue: 0.27),
    ]
    var hash = 0
    for scalar in name.unicodeScalars {
      hash = 31 &* hash &+ Int(scalar.value)
    }
    return palette[abs(hash) % palette.count]
  }

  private func hourLabel(_ date: Date) -> String {
    let hour = Calendar.current.component(.hour, from: date)
    if hour == 0 { return "12a" }
    if hour == 12 { return "12p" }
    if hour < 12 { return "\(hour)a" }
    return "\(hour - 12)p"
  }

  private static func formatDuration(_ interval: TimeInterval) -> String {
    let total = Int(interval.rounded())
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let seconds = total % 60
    if hours > 0 { return String(format: "%dh %02dm", hours, minutes) }
    if minutes > 0 { return String(format: "%dm", minutes) }
    return String(format: "%ds", seconds)
  }
}
