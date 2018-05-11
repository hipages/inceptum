import { UnauthorizedError } from '../web/errors/UnauthorizedError';

export class ApiKeyVerification {
  static verifyApiKey(apiKey) {
    return (req, authOrSecDef, scopesOrApiKey, callback) => {
      // apiKeyHeader is defined and used in swagger but apiKey is empty. Create an error.
      if (!apiKey) {
        return callback(new UnauthorizedError('Failed to set up an api key'));
      }

      if (scopesOrApiKey === apiKey) {
        return callback();
      }
      return callback(new UnauthorizedError('Failed to authenticate using api key'));
    };
  }
}
