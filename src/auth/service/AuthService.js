const jwt = require('jsonwebtoken');
const { Auth } = require('../Auth');

class AuthService {
  constructor(options) {
    this.publicKeys = options.publicKeys || {};
  }
  registerPublicKey(keyId, publicKeyPem) {
    this.publicKeys[keyId] = publicKeyPem;
  }
  removePublicKey(keyId) {
    delete this.publicKeys[keyId];
  }
  /**
   * Validates a signed Auth
   * @param {string} signed the signed auth to validate
   */
  validate(signed) {
    const headerEncoded = signed.substr(0, signed.indexOf('.'));
    const headerStr = Buffer.from(headerEncoded, 'base64').toString();
    const header = JSON.parse(headerStr);
    if (!header.keyid) {
      throw new Error('The JWT doesn\'t contain a key id. Can\'t validate');
    }
    const keyId = header.keyid;
    if (!this.publicKeys[keyId]) {
      throw new Error(`Unknown key id ${keyId}. Token is not valid`);
    }
    const publicKey = this.publicKeys[keyId];
    const verified = jwt.verify(signed, publicKey);
    return new Auth(verified.subT, verified.sub, verified.roles, verified.extraRoles);
  }
}

module.exports = { AuthService };
