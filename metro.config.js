const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const deviceActivityModule = path.resolve(__dirname, 'modules/flowsight-device-activity');

config.watchFolders = [...(config.watchFolders ?? []), deviceActivityModule];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'flowsight-device-activity': deviceActivityModule,
};

const previousGetTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const opts = previousGetTransformOptions
    ? await previousGetTransformOptions(...args)
    : { transform: {} };
  return {
    ...opts,
    transform: {
      ...opts.transform,
      inlineRequires: true,
    },
  };
};

module.exports = config;
