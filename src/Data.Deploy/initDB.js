const fs = require("fs");
const path = require("path");
const { SqliteDatabase } = require("../Services/Common.Services/dbHandler");
const Tables = require("../Constants/Tables");
const settings = require("../settings.json").settings;

class DBInitializer {
  static async init() {
    // Ensure Scripts folder exists for future migrations
    const scriptsRoot = path.join(process.cwd(), "src", "Data.Deploy", "Scripts");
    if (!fs.existsSync(scriptsRoot)) {
      fs.mkdirSync(scriptsRoot, { recursive: true });
    }

   // const dbPath = settings.dbPath;
    const db = new SqliteDatabase(dbPath);
    db.open();

    try {
      await db.run("PRAGMA foreign_keys = ON");

      // ContractVersion table (exact schema requirement)
      await db.run(
        `CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (
          Id INTEGER,
          Version FLOAT NOT NULL,
          Description TEXT,
          CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
          LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY("Id" AUTOINCREMENT)
        )`
      );

      // Token (singleton row)
      await db.run(
        `CREATE TABLE IF NOT EXISTS ${Tables.TOKEN} (
          Id INTEGER,
          Name TEXT NOT NULL,
          Symbol TEXT NOT NULL,
          TotalSupply INTEGER NOT NULL,
          Owner TEXT NOT NULL,
          CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY("Id" AUTOINCREMENT)
        )`
      );

      // Balances
      await db.run(
        `CREATE TABLE IF NOT EXISTS ${Tables.BALANCES} (
          PublicKey TEXT PRIMARY KEY,
          Balance INTEGER NOT NULL
        )`
      );

      // Transactions (for double-spend prevention)
      await db.run(
        `CREATE TABLE IF NOT EXISTS ${Tables.TRANSACTIONS} (
          TxId TEXT PRIMARY KEY,
          FromPubKey TEXT NOT NULL,
          ToPubKey TEXT NOT NULL,
          Amount INTEGER NOT NULL,
          Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );
    } finally {
      db.close(); //db close
    }
  }
}

module.exports = { DBInitializer };
//module.exports = { DBInitializer };
