const { withMainActivity, withAppDelegate } = require('@expo/config-plugins');

// The app is Arabic-only. I18nManager.forceRTL from JS needs a restart to take
// effect, so force the layout direction before React starts instead.

const ANDROID_IMPORT = 'import com.facebook.react.modules.i18nmanager.I18nUtil';
// Layout styles are written physical (e.g. left for what should sit right in
// RTL), so keep the left/right swap on; text alignment is compensated in theme.ts.
const ANDROID_CALLS = `    I18nUtil.getInstance().allowRTL(this, true)
    I18nUtil.getInstance().forceRTL(this, true)
    I18nUtil.getInstance().swapLeftAndRightInRTL(this, true)`;

const IOS_CALLS = `    RCTI18nUtil.sharedInstance().allowRTL(true)
    RCTI18nUtil.sharedInstance().forceRTL(true)
`;

module.exports = function withForcedRTL(config) {
  config = withMainActivity(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes('I18nUtil')) {
      contents = contents.replace(
        'import com.facebook.react.ReactActivity',
        `${ANDROID_IMPORT}\nimport com.facebook.react.ReactActivity`
      );
      contents = contents.replace(
        '  override fun onCreate(savedInstanceState: Bundle?) {\n',
        `  override fun onCreate(savedInstanceState: Bundle?) {\n${ANDROID_CALLS}\n`
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes('forceRTL')) {
      contents = contents.replace(
        '    let delegate = ReactNativeDelegate()',
        `${IOS_CALLS}\n    let delegate = ReactNativeDelegate()`
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
};
