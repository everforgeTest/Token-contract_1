const fs = require("fs");
const Tables = require("../../Constants/Tables");
const { SqliteDatabase } = require("./dbHandler");
const settings = require("../../settings.json").settings;

class UpgradeService {
  constructor(message) {
    this.message = message;
    this.db = new SqliteDatabase(settings.dbPath);
  }

  async upgradeContract(zipBuffer, incomingVersion, description) {
    this.db.open();
    try {
      // Read current version
      const row = await this.db.get(`SELECT Version FROM ${Tables.CONTRACTVERSION} ORDER BY Id DESC LIMIT 1`);
      const currentVersion = row ? parseFloat(row.Version) : 1.0;

      if (!(incomingVersion > currentVersion)) {
        return { error: { message: "Incoming version must be greater than current version", code: 403 } };
      }

      // Write ZIP
      fs.writeFileSync(settings.newContractZipFileName, zipBuffer);

      // Create post_exec.sh
      const script = `#!/bin/bash\
\
! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip\
\
zip_file=\"${settings.newContractZipFileName}\"\
\
unzip -o -d ./ \"$zip_file\" >>/dev/null\
\
echo \"Zip file '$zip_file' has been successfully unzipped and its contents have been written to the current directory.\"\
\
rm \"$zip_file\" >>/dev/null\
`;
      fs.writeFileSync(settings.postExecutionScriptName, script);
      fs.chmodSync(settings.postExecutionScriptName, 0o777);

      // Insert new version
      await this.db.run(
        `INSERT INTO ${Tables.CONTRACTVERSION} (Version, Description) VALUES (?, ?)`,
        [incomingVersion, description]
      );

      return { success: { message: "Contract upgraded", version: incomingVersion } };
    } catch (e) {
      return { error: { message: e.message || "Upgrade failed", code: 500 } };
    } finally {
      this.db.close();
    }
  }
}

module.exports = { UpgradeService };
