module.exports = {
  success: function (data) {
    return { success: data };
  },
  error: function (message, code) {
    return { error: { message: message, code: code || 500 } };
  }
};
