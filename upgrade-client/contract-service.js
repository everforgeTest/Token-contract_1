const HotPocket = require("hotpocket-js-client");
const bson = require("bson");

class ContractService {
  constructor(servers, keyPair) {
    this.servers = servers;
    this.keyPair = keyPair; // { publicKey: Buffer, privateKey: Buffer }
    this.client = null;
    this.promiseMap = new Map();
  }

  async init() {
    this.client = await HotPocket.createClient(this.servers, this.keyPair, { protocol: HotPocket.protocols.bson });

    this.client.on(HotPocket.events.disconnect, () => {
      console.log("Disconnected");
    });

    this.client.on(HotPocket.events.contractOutput, (r) => {
      r.outputs.forEach((o) => {
        let output;
        try { output = bson.deserialize(o); } catch (_) { try { output = JSON.parse(o.toString()); } catch (e) { output = null; } }
        if (!output) return;
        const pId = output.promiseId;
        if (pId && this.promiseMap.has(pId)) {
          const entry = this.promiseMap.get(pId);
          if (output.error) entry.rejecter(output.error); else entry.resolver(output.success || output);
          this.promiseMap.delete(pId);
        }
      });
    });

    if (!await this.client.connect()) {
      console.log("Connection failed.");
      return false;
    }

    console.log("HotPocket Connected.");
    return true;
  }

  submitInput(payload) {
    const promiseId = Math.random().toString(36).slice(2);
    const data = bson.serialize({ promiseId, ...payload });

    this.client.submitContractInput(data).then((input) => {
      input?.submissionStatus?.then((s) => {
        if (s.status !== "accepted") console.log(`Ledger_Rejection: ${s.reason}`);
      });
    });

    return new Promise((resolve, reject) => {
      this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });
      setTimeout(() => {
        if (this.promiseMap.has(promiseId)) {
          this.promiseMap.get(promiseId).rejecter({ message: "Timeout" });
          this.promiseMap.delete(promiseId);
        }
      }, 30000);
    });
  }
}

module.exports = { ContractService };
