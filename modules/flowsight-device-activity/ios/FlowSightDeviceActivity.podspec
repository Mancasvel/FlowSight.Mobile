require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'FlowSightDeviceActivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'FlowSight'
  s.homepage       = 'https://github.com/Mancasvel/FlowSight.Mobile'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'DeviceActivity', 'ManagedSettings', 'SwiftUI', 'UIKit'

  s.source_files = '**/*.{h,m,mm,swift}'
  s.exclude_files = 'ReportExtension/**', 'MonitorExtension/**'
end
