const sqlite3 = require("sqlite3").verbose();

class SqliteDatabase {
  constructor(dbFile) {
    this.dbFile = dbFile;
    this.db = null;
  }

  open() {
    if (!this.db) this.db = new sqlite3.Database(this.dbFile);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  run(query, params) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params ? params : [], function (err) {
        if (err) return reject(err);
        resolve({ lastId: this.lastID, changes: this.changes });
      });
    });
  }

  get(query, params) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params ? params : [], function (err, row) {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  all(query, params) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params ? params : [], function (err, rows) {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async begin() {
    await this.run("BEGIN TRANSACTION;");
  }

  async commit() {
    await this.run("COMMIT;");
  }

  async rollback() {
    await this.run("ROLLBACK;");
  }
}

module.exports = { SqliteDatabase };
