const { Context } = require('./ioc/Context');
const { ObjectDefinitionAutoconfigurationInspector } = require('./ioc/autoconfig/ObjectDefinitionAutoconfigurationInspector');

const BaseContext = new Context('BaseContext');
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionAutoconfigurationInspector());

const WebContext = new Context('WebContext', BaseContext);

module.exports = { Context, BaseContext, WebContext };
