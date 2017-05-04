const yaml = require('js-yaml');
const fs = require('fs');
const initSwaggerTools = require('swagger-tools').initializeMiddleware;

class SwaggerMetadataMiddleware {
  /**
   * Creates an instance of the Inceptum Swagger middleware.
   * This middleware injects into each request the metadata that is appropriate for this request
   * from the swagger file. Also, it will parse the parameters and body of the request.
   * It will NOT validate the request or the response.
   * @param {obj} config The configuration to use for this Middleware instance
   * @param {[obj]} config.swagger If provided, this is the swagger loaded as an object
   * @param {[string]} config.swaggerFilePath Required if config.swagger is not passed directly.
   * The location of the swagger yaml file
   */
  constructor(config) {
    this.swaggerFile = config.swagger || this.loadSwagger(config);
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
      e1.cause = e;
      throw e1;
    }
  }
  register(expressApp) {
    return new Promise((resolve) => {
      initSwaggerTools(this.swagger, (swaggerTools) => {
        const swaggerMetadataFunc = swaggerTools.swaggerMetadata();
        const swaggerValidatorFunc = swaggerTools.swaggerValidator();
        expressApp.use((req, res, next) => {
          swaggerMetadataFunc(req, res, (err) => {
            if (err) { return next(err); }
            return next();
          });
        });
        expressApp.use(swaggerValidatorFunc);
        resolve(expressApp);
      });
    });
  }
}

module.exports = { SwaggerMetadataMiddleware };
