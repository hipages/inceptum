require('./util/BluePatch');
const { Context } = require('./ioc/Context');
const LogManager = require('./log/LogManager');
const { PreinstantiatedSingletonDefinition } = require('./ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const { ObjectDefinitionAutowiringInspector } = require('./ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { ObjectDefinitionStartStopMethodsInspector } = require('./ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector');
const { MysqlConfigManager } = require('./mysql/MysqlConfigManager');
const { PromiseUtil } = require('./util/PromiseUtil');

const BaseContext = new Context('BaseContext');
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
MysqlConfigManager.registerSingletons(BaseContext);
BaseContext.registerDefinition(new PreinstantiatedSingletonDefinition(LogManager));

module.exports = { Context, BaseContext, LogManager, PromiseUtil };
