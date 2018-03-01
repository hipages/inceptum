import * as jwt from 'jsonwebtoken';
import * as config from 'config';

function assert(predicate, message) {
  if (!predicate) {
      throw new Error(message);
  }
}
export class JwtTokenClient {
  verify(token: string,
    options?: jwt.VerifyOptions): any {
    if (!options) {
        options = { algorithms: ['HS256'] };
    }
    const secret = config.get('authentication.jwt.secret');
    assert(secret, 'No secret found');
    return jwt.verify(token, secret, options);
  }

  sign(payload: object | string | Buffer,
    options?: jwt.SignOptions): string {
    if (!options) {
        options = { algorithm: 'HS256' };
    }
    const secret = config.get('authentication.jwt.secret');
    assert(secret, 'No secret found');
    return jwt.sign(payload, secret, options);
  }
}
