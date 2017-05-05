const { InceptumSwaggerApp } = require('./index');
const path = require('path');
const stringify = require('json-stringify-safe');

const swaggerFilePath = path.resolve(`${__dirname}/testSwagger.yaml`);

const inceptum = new InceptumSwaggerApp(swaggerFilePath);


inceptum.setPostSwaggerAppConfigurator((app) => {
  app.get('/', (req, resp) => {
    console.log(stringify(req));
    resp.send('Hello');
  });
  app.get('/todo', (req, resp) => {
    resp.send(`The page number is ${req.swagger.params.page.value}`);
  });
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send(`Something broke: ${err.message}`);
    next();
  });
});

inceptum.start();
