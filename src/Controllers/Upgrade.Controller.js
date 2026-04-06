const { UpgradeService } = require("../Services/Common.Services/Upgrade.Service");
const nacl = require("tweetnacl");

function isMaintainer(userPubKeyHex) {
  const expected = (process.env.MAINTAINER_PUBKEY || "").toLowerCase();
  if (!expected) return false;
  return (userPubKeyHex || "").toLowerCase() === expected;
}

class UpgradeController {
  constructor(message) {
    this.message = message;
    this.service = new UpgradeService(message);
  }

  async handleRequest(userPubKeyHex) {
    try {
      if (this.message.Action !== "UpgradeContract") {
        return { error: { message: "Invalid action." } };
      }

      if (!isMaintainer(userPubKeyHex)) {
        return { error: { message: "Unauthorized", code: 401 } };
      }

      const data = this.message.data || {};
      const version = parseFloat(data.version);
      const zipBase64 = data.zipBase64;
      const signatureHex = data.signatureHex;

      if (!zipBase64 || !signatureHex || !Number.isFinite(version)) {
        return { error: { message: "Invalid upgrade payload" } };
      }

      const zipBuffer = Buffer.from(zipBase64, "base64");
      const signature = Buffer.from(signatureHex, "hex");
      const pubKey = Buffer.from(userPubKeyHex, "hex");

      const verified = nacl.sign.detached.verify(new Uint8Array(zipBuffer), new Uint8Array(signature), new Uint8Array(pubKey));
      if (!verified) {
        return { error: { message: "Signature verification failed", code: 401 } };
      }

      return await this.service.upgradeContract(zipBuffer, version, data.description || "");
    } catch (e) {
      return { error: { message: e.message || "Upgrade failed", code: 500 } };
    }
  }
}

module.exports = { UpgradeController };
//module.exports = { UpgradeController };
//module.exports = { UpgradeController };
