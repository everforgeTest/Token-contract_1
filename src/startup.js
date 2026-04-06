const HotPocket = require("hotpocket-nodejs-contract");
const { Controller } = require("./controller");
const { DBInitializer } = require("./Data.Deploy/initDB");
const bson = require("bson");

const tokenContract = async (ctx) => {
  console.log("Token contract is running.");

  try {
    await DBInitializer.init();
  } catch (e) {
    console.error("DB init failed:", e);
  }

  const controller = new Controller();

  for (const user of ctx.users.list()) {
    for (const input of user.inputs) {
      const buf = await ctx.users.read(input);
      let message = null;
      try {
        message = JSON.parse(buf);
      } catch (e) {
        try { message = bson.deserialize(buf); } catch (_) {}
      }
      if (!message) {
        await user.send({ error: { message: "Invalid message payload" } });
        continue;
      }

      await controller.handleRequest(user, message, ctx.readonly);
    }
  }
};

const hpc = new HotPocket.Contract();
hpc.init(tokenContract, HotPocket.clientProtocols.JSON, true);
