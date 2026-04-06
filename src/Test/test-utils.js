module.exports = {
  assertEqual: function (a, b, msg) {
    if (a !== b) throw new Error(msg || `Assertion failed: ${a} !== ${b}`);
  },
  assertSuccessResponse: function (obj) {
    if (!obj || !obj.success) throw new Error("Expected success response");
  },
  assertErrorResponse: function (obj) {
    if (!obj || !obj.error) throw new Error("Expected error response");
  }
};
