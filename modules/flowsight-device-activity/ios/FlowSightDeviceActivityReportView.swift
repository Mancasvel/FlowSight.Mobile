import DeviceActivity
import ExpoModulesCore
import FamilyControls
import SwiftUI
import UIKit

final class FlowSightDeviceActivityReportView: ExpoView {
  private var hostingController: UIHostingController<SessionReportView>?

  var startMs: Double = 0 {
    didSet { render() }
  }

  var endMs: Double = 0 {
    didSet { render() }
  }

  var segment: String = "hourly" {
    didSet { render() }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .clear
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    attachHost()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
  }

  private func closestViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let controller = next as? UIViewController {
        return controller
      }
      responder = next
    }
    return nil
  }

  private func attachHost() {
    guard let host = hostingController, let parent = closestViewController() else { return }
    if host.parent !== parent {
      host.willMove(toParent: nil)
      host.removeFromParent()
      parent.addChild(host)
      host.didMove(toParent: parent)
    }
  }

  private func render() {
    let start = Date(timeIntervalSince1970: startMs / 1000)
    var end = Date(timeIntervalSince1970: endMs / 1000)
    if end.timeIntervalSince(start) < 60 {
      end = start.addingTimeInterval(60)
    }

    let root = SessionReportView(start: start, end: end, segment: segment)
    if let hostingController {
      hostingController.rootView = root
    } else {
      let controller = UIHostingController(rootView: root)
      controller.view.backgroundColor = .clear
      hostingController = controller
      addSubview(controller.view)
      attachHost()
    }
    hostingController?.view.frame = bounds
  }
}

struct SessionReportView: View {
  let start: Date
  let end: Date
  let segment: String

  var body: some View {
    DeviceActivityReport(
      DeviceActivityReport.Context(FlowSightReportContext.sessionApps),
      filter: filter
    )
  }

  private var filter: DeviceActivityFilter {
    let interval = DateInterval(start: start, end: end)
    let selection = SelectionStore.load()
    let segmentInterval: DeviceActivityFilter.SegmentInterval =
      segment == "daily" ? .daily(during: interval) : .hourly(during: interval)
    let devices = DeviceActivityFilter.Devices([.iPhone])

    // iOS 26: empty application/category sets match nothing. Omit `users`
    // so individual Family Controls authorization applies to this device.
    if let selection, SelectionStore.hasSelection(selection) {
      return DeviceActivityFilter(
        segment: segmentInterval,
        devices: devices,
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens
      )
    }

    return DeviceActivityFilter(
      segment: segmentInterval,
      devices: devices
    )
  }
}

enum FlowSightReportContext {
  static let sessionApps = "FlowSightSessionApps"
}
