const HotPocket = require("hotpocket-js-client");
const bson = require("bson");

/**
 * ContractService
 * ----------------
 * A thin client-side wrapper around hotpocket-js-client that:
 * - Connects to a set of HotPocket validator nodes using a provided Ed25519 key pair.
 * - Sends BSON-encoded inputs to the contract.
 * - Correlates asynchronous contract outputs back to the request using a generated promiseId.
 * - Exposes a simple Promise-based API (submitInput) with a timeout.
 *
 * Notes:
 * - The contract is expected to echo back the same `promiseId` in its output so we can resolve/reject
 *   the correct pending Promise.
 * - We default to BSON for efficiency and to support binary payloads.
 */
class ContractService {
  /**
   * @param {string[]} servers - Array of server URLs (e.g., ["wss://host:port"]).
   * @param {{ publicKey: Buffer, privateKey: Buffer }} keyPair - Ed25519 key pair for the client.
   */
  constructor(servers, keyPair) {
    this.servers = servers;
    this.keyPair = keyPair; // { publicKey: Buffer, privateKey: Buffer }
    this.client = null;
    /**
     * Internal map to track in-flight requests keyed by promiseId.
     * Value shape: { resolver: Function, rejecter: Function }
     */
    this.promiseMap = new Map();
  }

  /**
   * Initializes the HotPocket client, registers event handlers, and establishes a connection.
   * @returns {Promise<boolean>} true if connected; false otherwise.
   */
  async init() {
    // Create the HotPocket client using BSON protocol.
    this.client = await HotPocket.createClient(this.servers, this.keyPair, { protocol: HotPocket.protocols.bson });

    // Fired if the HP server disconnects unexpectedly.
    this.client.on(HotPocket.events.disconnect, () => {
      console.log("Disconnected");
    });

    // Handle contract outputs. We expect outputs to include the same promiseId
    // we sent, so we can resolve the correct pending Promise.
    this.client.on(HotPocket.events.contractOutput, (r) => {
      r.outputs.forEach((o) => {
        let output;
        // Attempt BSON first; fallback to JSON if needed.
        try { output = bson.deserialize(o); } catch (_) { try { output = JSON.parse(o.toString()); } catch (e) { output = null; } }
        if (!output) return;

        const pId = output.promiseId;
        if (pId && this.promiseMap.has(pId)) {
          const entry = this.promiseMap.get(pId);
          // If the contract output contains an error object, reject; otherwise resolve.
          if (output.error) entry.rejecter(output.error); else entry.resolver(output.success || output);
          // Clean up the pending promise entry.
          this.promiseMap.delete(pId);
        }
      });
    });

    // Establish the connection to validators.
    if (!await this.client.connect()) {
      console.log("Connection failed.");
      return false;
    }

    console.log("HotPocket Connected.");
    return true;
  }

  /**
   * Submits a BSON-encoded input payload to the contract.
   * The request is associated with a unique promiseId and returns a Promise that resolves
   * when the matching contract output is received (or rejects on timeout/error).
   *
   * @param {object} payload - Arbitrary object to be sent to the contract (Service/Action/data...).
   * @returns {Promise<any>} Resolves with the `success` part of the contract response or the raw output.
   */
  submitInput(payload) {
    // Simple unique ID for correlating request/response.
    const promiseId = Math.random().toString(36).slice(2);
    // Serialize the payload with the promiseId so the contract can echo it back.
    const data = bson.serialize({ promiseId, ...payload });

    // Submit to contract and optionally observe ledger acceptance.
    this.client.submitContractInput(data).then((input) => {
      input?.submissionStatus?.then((s) => {
        if (s.status !== "accepted") console.log(`Ledger_Rejection: ${s.reason}`);
      });
    });

    // Create and track a Promise that will be resolved/rejected upon receiving the matching output.
    return new Promise((resolve, reject) => {
      this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });

      // Basic safety timeout to avoid waiting indefinitely if no output arrives.
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
//module 
