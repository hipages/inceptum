const { Context } = require('./ioc/Context');
const { ObjectDefinitionAutowiringInspector } = require('./ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { ObjectDefinitionStartStopMethodsInspector } = require('./ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector');
const { MysqlConfigManager } = require('./mysql/MysqlConfigManager');

const BaseContext = new Context('BaseContext');
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
MysqlConfigManager.registerSingletons(BaseContext);

const { MainRouter } = require('./web/MainRouter');
const { WebApp } = require('./web/WebApp');
const { ControllerObjectDefinitionInspector } = require('./web/ControllerObjectDefinitionInspector');

const WebContext = new Context('WebContext', BaseContext);
WebContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
WebContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
WebContext.addObjectDefinitionInspector(new ControllerObjectDefinitionInspector());

WebContext.registerSingletons(MainRouter, WebApp);

module.exports = { Context, BaseContext, WebContext };
