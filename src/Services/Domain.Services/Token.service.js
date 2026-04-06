const Tables = require("../../Constants/Tables");
const { SqliteDatabase } = require("../Common.Services/dbHandler");
const settings = require("../../settings.json").settings;

class TokenService {
  constructor(message) {
    this.message = message;
    this.db = new SqliteDatabase(settings.dbPath);
  }

  async createToken(userPubKeyHex) {
    const data = this.message.data || {};
    const name = data.name;
    const symbol = data.symbol;
    const totalSupply = parseInt(data.totalSupply);

    if (!name || !symbol || !Number.isInteger(totalSupply) || totalSupply < 0) {
      return { error: { message: "Invalid token parameters" } };
    }

    this.db.open();
    try {
      const existing = await this.db.get(`SELECT * FROM ${Tables.TOKEN} LIMIT 1`);
      if (existing) {
        return { error: { message: "Token already exists" } };
      }

      await this.db.begin();
      await this.db.run(
        `INSERT INTO ${Tables.TOKEN} (Name, Symbol, TotalSupply, Owner) VALUES (?, ?, ?, ?)`,
        [name, symbol, totalSupply, userPubKeyHex]
      );

      // Credit the creator with total supply
      await this.db.run(
        `INSERT INTO ${Tables.BALANCES} (PublicKey, Balance) VALUES (?, ?)`,
        [userPubKeyHex, totalSupply]
      );

      await this.db.commit();
      return { success: { message: "Token created", name, symbol, totalSupply } };
    } catch (e) {
      try { await this.db.rollback(); } catch (_) {}
      return { error: { message: e.message || "Failed to create token" } };
    } finally {
      this.db.close();
    }
  }

  async transfer(userPubKeyHex) {
    const data = this.message.data || {};
    const to = data.to;
    const amount = parseInt(data.amount);
    const txId = data.txId;

    if (!to || !Number.isInteger(amount) || amount <= 0 || !txId) {
      return { error: { message: "Invalid transfer parameters" } };
    }

    if (to.toLowerCase() === userPubKeyHex.toLowerCase()) {
      return { error: { message: "Cannot transfer to self" } };
    }

    this.db.open();
    try {
      // Ensure token exists
      const token = await this.db.get(`SELECT * FROM ${Tables.TOKEN} LIMIT 1`);
      if (!token) return { error: { message: "Token not initialized" } };

      // Double-spend prevention
      const existingTx = await this.db.get(
        `SELECT TxId FROM ${Tables.TRANSACTIONS} WHERE TxId = ?`,
        [txId]
      );
      if (existingTx) return { error: { message: "Duplicate transaction" } };

      await this.db.begin();

      // Get current balance of sender
      const senderRow = await this.db.get(
        `SELECT Balance FROM ${Tables.BALANCES} WHERE PublicKey = ?`,
        [userPubKeyHex]
      );
      const senderBal = senderRow ? parseInt(senderRow.Balance) : 0;
      if (senderBal < amount) {
        await this.db.rollback();
        return { error: { message: "Insufficient balance" } };
      }

      // Debit sender
      const newSenderBal = senderBal - amount;
      await this.db.run(
        `INSERT INTO ${Tables.BALANCES} (PublicKey, Balance) VALUES (?, ?) ON CONFLICT(PublicKey) DO UPDATE SET Balance = excluded.Balance`,
        [userPubKeyHex, newSenderBal]
      );

      // Credit recipient
      const recipientRow = await this.db.get(
        `SELECT Balance FROM ${Tables.BALANCES} WHERE PublicKey = ?`,
        [to]
      );
      const recipientBal = recipientRow ? parseInt(recipientRow.Balance) : 0;
      const newRecipientBal = recipientBal + amount;
      await this.db.run(
        `INSERT INTO ${Tables.BALANCES} (PublicKey, Balance) VALUES (?, ?) ON CONFLICT(PublicKey) DO UPDATE SET Balance = excluded.Balance`,
        [to, newRecipientBal]
      );

      // Record transaction
      await this.db.run(
        `INSERT INTO ${Tables.TRANSACTIONS} (TxId, FromPubKey, ToPubKey, Amount) VALUES (?, ?, ?, ?)`,
        [txId, userPubKeyHex, to, amount]
      );

      await this.db.commit();
      return { success: { message: "Transfer succeeded", from: userPubKeyHex, to, amount } };
    } catch (e) {
      try { await this.db.rollback(); } catch (_) {}
      return { error: { message: e.message || "Transfer failed" } };
    } finally {
      this.db.close();
    }
  }

  async getBalance() {
    const data = this.message.data || {};
    const pk = data.publicKey;
    if (!pk) return { error: { message: "publicKey required" } };

    this.db.open();
    try {
      const row = await this.db.get(
        `SELECT Balance FROM ${Tables.BALANCES} WHERE PublicKey = ?`,
        [pk]
      );
      const balance = row ? parseInt(row.Balance) : 0;
      return { success: { publicKey: pk, balance } };
    } catch (e) {
      return { error: { message: e.message || "Failed to get balance" } };
    } finally {
      this.db.close();
    }
  }

  async getTokenInfo() {
    this.db.open();
    try {
      const token = await this.db.get(`SELECT * FROM ${Tables.TOKEN} LIMIT 1`);
      if (!token) return { error: { message: "Token not initialized" } };
      return {
        success: {
          name: token.Name,
          symbol: token.Symbol,
          totalSupply: parseInt(token.TotalSupply),
          owner: token.Owner,
          createdOn: token.CreatedOn
        }
      };
    } catch (e) {
      return { error: { message: e.message || "Failed to get token info" } };
    } finally {
      this.db.close();
    }
  }
}

//module.exports = { TokenService };
