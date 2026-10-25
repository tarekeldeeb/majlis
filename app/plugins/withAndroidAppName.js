const { withStringsXml } = require('@expo/config-plugins');

const ANDROID_NAME = 'Majlis Auto';

module.exports = function withAndroidAppName(config) {
  return withStringsXml(config, (cfg) => {
    const strings = cfg.modResults.resources.string || [];
    const entry = strings.find((s) => s.$ && s.$.name === 'app_name');
    if (entry) {
      entry._ = ANDROID_NAME;
    } else {
      strings.push({ $: { name: 'app_name' }, _: ANDROID_NAME });
    }
    cfg.modResults.resources.string = strings;
    return cfg;
  });
};
