import DeviceActivity
import SwiftUI

@main
struct FlowSightReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    SessionActivityReport { configuration in
      SessionActivityView(configuration: configuration)
    }
  }
}
