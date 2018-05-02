import * as xmlbuilder from 'xmlbuilder';

/**
 * To use this middleware with swagger, set xml root tag name in relevant definition in swagger.yml
 */
export class ContentNegotiationMiddleware {
  private xmlRoot: string;

  constructor(xmlRoot: string) {
    this.xmlRoot = xmlRoot;
  }

  register(expressApp) {
    const xmlRoot = this.xmlRoot;
    if (!xmlRoot) {
      return;
    }
    expressApp.use((req, res, next) => {
      const xmlType = 'application/xml';
      if (req.is(xmlType) || xmlType === req.get('accept')) {
        const originalSend = res.send;
        res.send = function(...data) {
          const obj = {};
          obj[xmlRoot] = data[0];
          data[0] = xmlbuilder.create(obj).end();
          originalSend.apply(res, data);
        };
        res.header('content-type', xmlType);
      }
      next();
    });
  }
}
