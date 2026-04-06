const { TokenService } = require("../Services/Domain.Services/Token.service");

class TokenController {
  constructor(message) {
    this.message = message;
    this.service = new TokenService(message);
  }

  async handleRequest(userPubKeyHex) {
    try {
      switch (this.message.Action) {
        case "CreateToken":
          return await this.service.createToken(userPubKeyHex);
        case "Transfer":
          return await this.service.transfer(userPubKeyHex);
        case "GetBalance":
          return await this.service.getBalance();
        case "GetTokenInfo":
          return await this.service.getTokenInfo();
        default:
          return { error: { message: "Invalid action." } };
      }
    } catch (e) {
      return { error: { message: e.message || "Controller error" } };
    }
  }
}

module.exports = { TokenController };
//module.exports = { TokenController };
//module.exports = { TokenController };
