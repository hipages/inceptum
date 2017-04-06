const { Auth } = require('../Auth');
const { AuthService } = require('./AuthService');
const jwt = require('jsonwebtoken');

class SigningAuthService extends AuthService {
  constructor(options) {
    super(options);
    options = options || {};
    if (!options.issuer) throw new Error('Please specify an issuer in the options');
    if (!options.privateKeyId) throw new Error('Please specify a privateKeyId in the options');
    if (!options.privateKeyPem) throw new Error('Please specify a privateKeyPem in the options');
    this.privateKeyPem = options.privateKeyPem;
    this.tokenOptions = Object.assign({
      algorithm: 'RS512',
      expiresIn: '30d',
      header: {}
    }, options.tokenOptions || {});
    this.tokenOptions.issuer = options.issuer;
    this.tokenOptions.header.keyid = options.privateKeyId;
  }
  /**
   * Signs an Auth object
   * @param {Auth} auth The authorisation to convert into a signed token
   */
  sign(auth) {
    if (!(auth instanceof Auth)) throw new Error('Provided input to sign is not an Auth');
    const payload = {
      sub: auth.getId(),
      subT: auth.getType(),
      roles: auth.getRoles(),
      extraRoles: auth.getExtraRoles()
    };
    return jwt.sign(payload, this.privateKeyPem, this.tokenOptions);
  }

}

module.exports = { SigningAuthService };
