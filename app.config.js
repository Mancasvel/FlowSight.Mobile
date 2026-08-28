const appJson = require('./app.json');

module.exports = () => {
  const storeBuild = ['production', 'preview'].includes(process.env.EAS_BUILD_PROFILE ?? '');
  const expo = {
    ...appJson.expo,
    plugins: [...appJson.expo.plugins],
  };

  if (storeBuild) {
    expo.plugins = expo.plugins.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-dev-client';
    });
  }

  return expo;
};
