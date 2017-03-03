const moduleAlias = require('module-alias');

moduleAlias.addAlias('co', `${__dirname}/CoroutineReplacement.js`);
