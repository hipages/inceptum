import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { initializeMiddleware } from 'swagger-tools';

export default class SwaggerMetadataMiddleware {
  swagger: object;
  swaggerFile: string;
  logger: any; // TODO

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
  constructor(config) {
    this.swaggerFile = config.swagger || this.loadSwagger(config);
    this.logger = config.logger;
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
  register(expressApp): Promise<void> {
    return new Promise<void>((resolve) => {
      initializeMiddleware(this.swagger, (swaggerTools) => {
        // logger.debug('Adding swagger middleware');
        const swaggerMetadataFunc = swaggerTools.swaggerMetadata();
        const swaggerValidatorFunc = swaggerTools.swaggerValidator();
        expressApp.use((req, res, next) => {
          swaggerMetadataFunc(req, res, (err) => {
            if (err) { return next(err); }
            return next();
          });
        });
        expressApp.use(swaggerValidatorFunc);
        // logger.debug('Adding swagger middleware - Done');
        resolve();
      });
    });
  }
}
