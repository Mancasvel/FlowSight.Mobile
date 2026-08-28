const fs = require('fs');
const path = require('path');
const {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');

const FAMILY_CONTROLS = 'com.apple.developer.family-controls';
const DEPLOYMENT_TARGET = '16.0';

const EXTENSIONS = [
  {
    folder: 'FlowSightDeviceActivityReport',
    sourceDir: 'ReportExtension',
    bundleSuffix: 'DeviceActivityReport',
    productType: 'com.apple.product-type.extensionkit-extension',
    frameworks: ['DeviceActivity', 'FamilyControls', 'ManagedSettings', 'SwiftUI', 'ManagedSettingsUI'],
    sourceFiles: ['FlowSightReportExtension.swift', 'SessionActivityReport.swift'],
  },
  {
    folder: 'FlowSightDeviceActivityMonitor',
    sourceDir: 'MonitorExtension',
    bundleSuffix: 'DeviceActivityMonitor',
    productType: 'com.apple.product-type.app-extension',
    frameworks: ['DeviceActivity', 'FamilyControls', 'ManagedSettings'],
    sourceFiles: ['FlowSightDeviceActivityMonitor.swift'],
  },
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function ensureProjectObjects(project) {
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency || {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};
  objects.PBXCopyFilesBuildPhase = objects.PBXCopyFilesBuildPhase || {};
  objects.PBXFrameworksBuildPhase = objects.PBXFrameworksBuildPhase || {};
}

function applyTargetBuildSettings(project, targetName, settings) {
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const config = configurations[key];
    if (typeof config.buildSettings === 'undefined') continue;
    if (config.buildSettings.PRODUCT_NAME === `"${targetName}"`) {
      Object.assign(config.buildSettings, settings);
    }
  }
}

function setProductType(project, targetName, productType) {
  const natives = project.pbxNativeTargetSection();
  for (const key of Object.keys(natives)) {
    const target = natives[key];
    if (target && target.name === `"${targetName}"`) {
      target.productType = `"${productType}"`;
    }
  }
}

function addExtensionTarget(project, config, extension) {
  const bundleIdentifier = config.ios?.bundleIdentifier ?? 'ai.flowsight.mobile';
  const extensionBundleId = `${bundleIdentifier}.${extension.bundleSuffix}`;

  if (project.pbxTargetByName(extension.folder)) {
    return;
  }

  ensureProjectObjects(project);

  const target = project.addTarget(
    extension.folder,
    'app_extension',
    extension.folder,
    extensionBundleId
  );

  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

  const group = project.addPbxGroup(
    ['Info.plist', `${extension.folder}.entitlements`],
    extension.folder,
    extension.folder
  );

  const groups = project.hash.project.objects.PBXGroup;
  Object.keys(groups).forEach((key) => {
    if (typeof groups[key] !== 'object') return;
    if (groups[key].name === undefined && groups[key].path === undefined) {
      project.addToPbxGroup(group.uuid, key);
    }
  });

  for (const file of extension.sourceFiles) {
    project.addSourceFile(file, { target: target.uuid }, group.uuid);
  }

  for (const framework of extension.frameworks) {
    project.addFramework(`${framework}.framework`, { target: target.uuid, weak: true });
  }

  setProductType(project, extension.folder, extension.productType);

  applyTargetBuildSettings(project, extension.folder, {
    IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
    TARGETED_DEVICE_FAMILY: '"1"',
    SWIFT_VERSION: '5.0',
    SKIP_INSTALL: 'YES',
    GENERATE_INFOPLIST_FILE: 'NO',
    INFOPLIST_FILE: `${extension.folder}/Info.plist`,
    CODE_SIGN_ENTITLEMENTS: `${extension.folder}/${extension.folder}.entitlements`,
    CODE_SIGN_STYLE: 'Automatic',
    DEVELOPMENT_TEAM: config.ios?.appleTeamId ?? 'MLUJVMGV82',
    PRODUCT_BUNDLE_IDENTIFIER: extensionBundleId,
    PRODUCT_NAME: `"${extension.folder}"`,
    CURRENT_PROJECT_VERSION: '1',
    MARKETING_VERSION: config.version ?? '1.0.0',
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    APPLICATION_EXTENSION_API_ONLY: 'YES',
  });
}

function withFamilyControls(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults[FAMILY_CONTROLS] = true;
    return mod;
  });
}

function withExtensionSources(config) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const moduleIos = path.join(
        mod.modRequest.projectRoot,
        'modules/flowsight-device-activity/ios'
      );
      for (const extension of EXTENSIONS) {
        copyDir(
          path.join(moduleIos, extension.sourceDir),
          path.join(mod.modRequest.platformProjectRoot, extension.folder)
        );
      }
      return mod;
    },
  ]);
}

function withExtensionTargets(config) {
  return withXcodeProject(config, (mod) => {
    for (const extension of EXTENSIONS) {
      addExtensionTarget(mod.modResults, mod, extension);
    }
    return mod;
  });
}

function withAppSizeSettings(config) {
  return withXcodeProject(config, (mod) => {
    const configurations = mod.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const cfg = configurations[key];
      if (!cfg.buildSettings) continue;
      cfg.buildSettings.ENABLE_DEBUG_DYLIB = 'NO';
      if (cfg.name === 'Release') {
        cfg.buildSettings.DEAD_CODE_STRIPPING = 'YES';
        cfg.buildSettings.STRIP_INSTALLED_PRODUCT = 'YES';
        cfg.buildSettings.DEPLOYMENT_POSTPROCESSING = 'YES';
        cfg.buildSettings.ASSETCATALOG_COMPILER_OPTIMIZATION = 'space';
        cfg.buildSettings.GCC_OPTIMIZATION_LEVEL = 's';
      }
    }
    return mod;
  });
}

function withFlowSightDeviceActivity(config) {
  config = withFamilyControls(config);
  config = withExtensionSources(config);
  config = withExtensionTargets(config);
  config = withAppSizeSettings(config);
  return config;
}

module.exports = withFlowSightDeviceActivity;
