const ServiceTypes = require("./Constants/ServiceTypes");
const { TokenController } = require("./Controllers/Token.Controller");
const { UpgradeController } = require("./Controllers/Upgrade.Controller");
const bson = require("bson");

class Controller {
  async handleRequest(user, message, isReadOnly) {
    const service = message.Service || message.service;
    let result = {};

    try {
      if (service === ServiceTypes.UPGRADE) {
        const ctrl = new UpgradeController(message);
        const pubKey = user.publicKey || user.pubKey || "";
        result = await ctrl.handleRequest(pubKey);
      } else if (service === ServiceTypes.TOKEN) {
        const ctrl = new TokenController(message);
        const pubKey = user.publicKey || user.pubKey || "";
        result = await ctrl.handleRequest(pubKey);
      } else {
        result = { error: { message: "Unknown service" } };
      }
    } catch (e) {
      result = { error: { message: e.message || "Unhandled error" } };
    }

    await this.sendOutput(user, result);
  }

  async sendOutput(user, response) {
    try {
      // Auto-detect if user expects BSON or JSON outputs based on input; send JSON for simplicity
      await user.send(response);
    } catch (e) {
      try { await user.send(bson.serialize(response)); } catch (_) {}
    }
  }
}

module.exports = { Controller };
