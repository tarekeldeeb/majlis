const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

// Downloaded narration (files/narration/) can always be fetched again, and at ~1 GB it is
// far over Android's 25 MB backup quota, which would stop the app's settings and
// progress being backed up at all. Cloud backups leave it out; device transfers keep it.
const FULL_BACKUP = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="file" path="narration/" />
</full-backup-content>
`;

const DATA_EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="file" path="narration/" />
  </cloud-backup>
</data-extraction-rules>
`;

module.exports = function withBackupRules(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'majlis_backup_rules.xml'), FULL_BACKUP);
      fs.writeFileSync(path.join(dir, 'majlis_data_extraction_rules.xml'), DATA_EXTRACTION);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application[0];
    application.$['android:fullBackupContent'] = '@xml/majlis_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/majlis_data_extraction_rules';
    return cfg;
  });
};
