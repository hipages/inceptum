import * as jwt from 'jsonwebtoken';
import * as config from 'config';

export class JwtTokenClient {
  verify(token: string,
    options?: jwt.VerifyOptions): any {
    if (!options) {
        options = { algorithms: ['HS256'] };
    }
    return jwt.verify(token, config.get('authentication.jwt.secret'), options);
  }

  sign(payload: object | string | Buffer,
    options?: jwt.SignOptions): string {
    if (!options) {
        options = { algorithm: 'HS256' };
    }
    return jwt.sign(payload, config.get('authentication.jwt.secret'), options);
  }
}
