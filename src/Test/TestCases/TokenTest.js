const HotPocket = require("hotpocket-js-client");
const { assertEqual, assertSuccessResponse } = require("../test-utils");

async function run() {
  const kp = await HotPocket.generateKeys();
  const client = await HotPocket.createClient(["wss://localhost:8081"], kp);
  if (!await client.connect()) throw new Error("Failed to connect");

  // Create token (may fail if already exists)
  let resp = await client.submitContractReadRequest(Buffer.from(JSON.stringify({ Service: "Token", Action: "GetTokenInfo" })));
  let info;
  try { info = JSON.parse(resp.toString()); } catch (_) { info = null; }
  if (!info || info.error) {
    const create = { Service: "Token", Action: "CreateToken", data: { name: "MyToken", symbol: "MTK", totalSupply: 1000 } };
    const out = await client.submitContractReadRequest(Buffer.from(JSON.stringify(create)));
    const parsed = JSON.parse(out.toString());
    assertSuccessResponse(parsed);
  }

  // Get creator balance
  const balResp = await client.submitContractReadRequest(Buffer.from(JSON.stringify({ Service: "Token", Action: "GetBalance", data: { publicKey: Buffer.from(kp.publicKey).toString('hex') } })));
  const balObj = JSON.parse(balResp.toString());
  assertSuccessResponse(balObj);
  console.log("Balance:", balObj.success.balance);

  client.close();
}

module.exports = { run };
