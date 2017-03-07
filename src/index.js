require('./util/PatchCoroutine');
const { Context } = require('./ioc/Context');
const LogManager = require('./log/LogManager');
const { PreinstantiatedSingletonDefinition } = require('./ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const { ObjectDefinitionAutowiringInspector } = require('./ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { ObjectDefinitionStartStopMethodsInspector } = require('./ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector');
const { ObjectDefinitionTransactionalInspector } = require('./ioc/autoconfig/ObjectDefinitionTransactionalInspector');
const { MysqlConfigManager } = require('./mysql/MysqlConfigManager');

const BaseContext = new Context('BaseContext');
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionTransactionalInspector());
MysqlConfigManager.registerSingletons(BaseContext);
BaseContext.registerDefinition(new PreinstantiatedSingletonDefinition(LogManager));

const { MainRouter } = require('./web/MainRouter');
const { WebApp } = require('./web/WebApp');

const WebContext = new Context('WebContext', BaseContext);
WebContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
WebContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
WebContext.addObjectDefinitionInspector(new ObjectDefinitionTransactionalInspector());

WebContext.registerSingletons(MainRouter, WebApp);

module.exports = { Context, BaseContext, WebContext, LogManager };
