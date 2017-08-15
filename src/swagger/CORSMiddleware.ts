const hasOwnProperty = Object.prototype.hasOwnProperty;
const possibleMethods = ['OPTIONS', 'GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'PATCH'];

function getAccessMethods(swagger) {
  if (!swagger.path) {
    return [];
  }
  return possibleMethods
    .filter(
      (method) =>
        method === 'OPTIONS' ||
        hasOwnProperty.call(swagger.path, method) ||
        hasOwnProperty.call(swagger.path, method.toLowerCase()),
    )
    .map((t) => t.toUpperCase());
}

export default function createCorsMiddlware({allowedOrigins = '*', allowedHeaders = ['Content-type'], allowedMaxAge =  300}) {
  return function CORSMiddlware(req, res, next) {
    if (req.swagger && req.swagger.path) {
      const allowedMethods = getAccessMethods(req.swagger);
      res.set('Access-Control-Allow-Methods', allowedMethods.join(', '));
      const accessControllMethod = req.get('Access-Control-Request-Method');
      if (accessControllMethod && allowedMethods.indexOf(accessControllMethod) < 0) {
        // The requester will try a method that is not allowed
        // Not clear what needs to be done here
      }
      res.set('Access-Control-Allow-Origin', allowedOrigins);
      res.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.set('Access-Control-Max-Age', allowedMaxAge);
      if (req.method === 'OPTIONS') {
        res.send();
        return;
      }
    }
    next();
  };
}
