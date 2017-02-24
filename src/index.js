const { Context } = require('./ioc/Context');

const BaseContext = new Context('BaseContext');

const WebContext = new Context('WebContext', BaseContext);

module.exports = { Context, BaseContext, WebContext };
