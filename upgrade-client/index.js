const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");
const { ContractService } = require("./contract-service");

// Usage:
// node index.js <contractUrl> <zipFilePath> <privateKeyHex> <version> <description>

(async () => {
  const contractUrl = process.argv[2];
  const filepath = process.argv[3];
  const privHex = process.argv[4];
  const version = process.argv[5];
  const description = process.argv[6] || "";

  if (!contractUrl || !filepath || !privHex || !version) {
    console.log("Usage: node index.js <contractUrl> <zipFilePath> <privateKeyHex> <version> <description>");
    process.exit(1);
  }

  const zipBuffer = fs.readFileSync(filepath);

  let seed;
  const privBuf = Buffer.from(privHex, "hex");
  if (privBuf.length === 32) seed = privBuf; // seed
  else if (privBuf.length === 64) seed = privBuf.slice(0, 32); // secret key -> take seed part
  else {
    console.error("privateKeyHex must be 32 or 64 bytes in hex.");
    process.exit(1);
  }

  const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  const publicKey = Buffer.from(kp.publicKey);
  const privateKey = Buffer.from(kp.secretKey);

  const signature = nacl.sign.detached(new Uint8Array(zipBuffer), new Uint8Array(kp.secretKey));
  const signatureHex = Buffer.from(signature).toString("hex");
  const zipBase64 = zipBuffer.toString("base64");

  const keyPair = { publicKey, privateKey };
  const svc = new ContractService([contractUrl], keyPair);
  const ok = await svc.init();
  if (!ok) process.exit(1);

  const payload = {
    Service: "Upgrade",
    Action: "UpgradeContract",
    data: {
      version: parseFloat(version),
      description,
      zipBase64,
      signatureHex
    }
  };

  try {
    const res = await svc.submitInput(payload);
    console.log("Upgrade response:", res);
  } catch (e) {
    console.error("Upgrade failed:", e);
  } finally {
    process.exit(0);
  }
})();
