import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { initializeMiddleware } from 'swagger-tools';
import { JwtTokenClient } from '../jwt/JwtTokenClient';
import { UnauthorizedError } from '../web/errors/UnauthorizedError';

export interface SwaggerMetadataMiddlewareConfig {
  swaggerFilePath: string,
  apiKey: string,
  swagger?: any,
  logger?: Logger,
}

export default class SwaggerMetadataMiddleware {
  swagger: object;
  swaggerFile: string;
  logger: any; // TODO
  private apiKey: string;

  /**
   * Creates an instance of the Inceptum Swagger middleware.
   * This middleware injects into each request the metadata that is appropriate for this request
   * from the swagger file. Also, it will parse the parameters and body of the request.
   * It will NOT validate the request or the response.
   * @param object config The configuration to use for this Middleware instance
   * @param [any] config.swagger If provided, this is the swagger loaded as an object
   * @param [string] config.swaggerFilePath Required if config.swagger is not passed directly.
   * The location of the swagger yaml file
   */
  constructor(config: SwaggerMetadataMiddlewareConfig) {
    this.swaggerFile = config.swagger || this.loadSwagger(config);
    this.logger = config.logger;
    this.apiKey = config.apiKey;
  }
  loadSwagger(config) {
    if (!config.swaggerFilePath) {
      throw new Error('Need to specify the swaggerFilePath in the config');
    }
    try {
      const swaggerString = fs.readFileSync(config.swaggerFilePath, 'utf8');
      this.swagger = yaml.safeLoad(swaggerString);
    } catch (e) {
      const e1 = new Error(`There was an error reading swagger yaml file: ${e.message}`);
      // e1.cause = e as any;
      throw e1;
    }
  }

  jwtHandler(req, authOrSecDef, scopesOrApiKey, callback) {
    const jwt = new JwtTokenClient();
    try {
      const token = jwt.verify(scopesOrApiKey);
      if (token !== null) {
        req.decodedToken = token;
        return callback();
      }
    } catch (e) {
      return callback(new UnauthorizedError('Failed to authenticate using bearer token'));
    }
    return callback(new UnauthorizedError('Failed to authenticate using bearer token'));
  }

  /**
   * swagger security definition name needs to be apiKey
   * @param req
   * @param authOrSecDef
   * @param scopesOrApiKey
   * @param callback
   */
  verifyApiKey(req, authOrSecDef, scopesOrApiKey, callback) {
    return this.apiKey && scopesOrApiKey === this.apiKey;
  }

  register(expressApp): Promise<void> {
    return new Promise<void>((resolve) => {
      initializeMiddleware(this.swagger, (swaggerTools) => {
        // logger.debug('Adding swagger middleware');
        const swaggerMetadataFunc = swaggerTools.swaggerMetadata();
        const swaggerValidatorFunc = swaggerTools.swaggerValidator();
        const swaggerSecurityFunc = swaggerTools.swaggerSecurity({jwt: this.jwtHandler});

        expressApp.use((req, res, next) => {
          swaggerMetadataFunc(req, res, (err) => {
            if (err) { return next(err); }
            return next();
          });
        });
        expressApp.use(swaggerSecurityFunc);
        expressApp.use(swaggerValidatorFunc);
        // swagger security definition name needs to be apiKey
        if (this.apiKey) {
          expressApp.use(swaggerTools.swaggerSecurity({ apiKey: this.verifyApiKey }));
        }

        // logger.debug('Adding swagger middleware - Done');
        resolve();
      });
    });
  }
}
