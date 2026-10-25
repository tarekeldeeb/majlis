const { withGradleProperties } = require('@expo/config-plugins');

// x86/x86_64 only serve emulators; shipping them doubles build time and APK size.
const ARCHITECTURES = 'armeabi-v7a,arm64-v8a';

module.exports = function withAndroidAbiFilters(config) {
  return withGradleProperties(config, (cfg) => {
    const items = cfg.modResults;
    const existing = items.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (existing) {
      existing.value = ARCHITECTURES;
    } else {
      items.push({ type: 'property', key: 'reactNativeArchitectures', value: ARCHITECTURES });
    }
    return cfg;
  });
};
