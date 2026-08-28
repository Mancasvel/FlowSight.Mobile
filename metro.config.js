const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const deviceActivityModule = path.resolve(__dirname, 'modules/flowsight-device-activity');

config.watchFolders = [...(config.watchFolders ?? []), deviceActivityModule];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'flowsight-device-activity': deviceActivityModule,
};

module.exports = config;
