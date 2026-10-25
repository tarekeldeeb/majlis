const { withAppBuildGradle } = require('@expo/config-plugins');

const SENTINEL = 'majlis-release-signing';

// Credentials live in ~/.majlis/keystore.properties, never in the repo.
const RELEASE_BLOCK = `        // ${SENTINEL}
        release {
            def keystoreProps = new Properties()
            def keystorePropsFile = new File(System.getenv('HOME'), '.majlis/keystore.properties')
            if (keystorePropsFile.exists()) {
                keystoreProps.load(new FileInputStream(keystorePropsFile))
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
`;

const TEMPLATE_RELEASE = /release \{\n\s*\/\/ Caution! In production[^\n]*\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n\s*signingConfig signingConfigs\.debug/;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(SENTINEL)) return cfg;

    contents = contents.replace(
      '    signingConfigs {\n        debug {',
      `    signingConfigs {\n${RELEASE_BLOCK}        debug {`
    );
    contents = contents.replace(
      TEMPLATE_RELEASE,
      'release {\n            signingConfig signingConfigs.release'
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
};
