const { run } = require("./TestCases/TokenTest");

(async () => {
  try {
    await run();
    console.log("All tests passed.");
  } catch (e) {
    console.error("Tests failed:", e);
    process.exit(1);
  }
})();
