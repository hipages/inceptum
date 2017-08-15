import { Context } from '../ioc/Context';
import { LogManager, Logger } from '../log/LogManager';
import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import { ObjectDefinitionStartStopMethodsInspector } from '../ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector';
import { ObjectDefinitionLazyLoadingInspector } from '../ioc/autoconfig/ObjectDefinitionLazyLoadingInspector';
import { LifecycleState } from '../ioc/Lifecycle';
import Config, { ConfigAdapater } from '../config/ConfigProvider';

export type PluginLifecycleMethodName = 'willStart' | 'didStart' | 'willStop' | 'didStop';
export type PluginLifecycleMethod = (app: BaseApp, pluginContext?: Map<String, any>) => Promise<void> | void;

export type PluginType = {
  [method in PluginLifecycleMethodName]: PluginLifecycleMethod;
};

export interface Plugin {
  name: string,
  willStart?: PluginLifecycleMethod,
  didStart?: PluginLifecycleMethod,
  willStop?: PluginLifecycleMethod,
  didStop?: PluginLifecycleMethod,
}

export interface PluginWithWillStart {
  willStart: PluginLifecycleMethod,
}

export interface PluginWithDidStart {
  didStart: PluginLifecycleMethod,
}

export interface PluginWithWillStop {
  willStop: PluginLifecycleMethod,
}

export interface PluginWithDidStop {
  didStop: PluginLifecycleMethod,
}

export interface PluginNameable {
  name: string,
}

export type PluginImplementsAtLeastOneMethod = PluginWithWillStart | PluginWithDidStart | PluginWithWillStop | PluginWithDidStop;
export type PluginImplemenation = PluginNameable & PluginImplementsAtLeastOneMethod;

export interface AppOptions {
  logger?: Logger,
  config?: ConfigAdapater,
}

export default class BaseApp {
  private logger: Logger;
  private context: Context;
  private appName: string;

  private plugins: PluginImplemenation[] = [];
  private pluginContext: Map<String, any> = new Map();

  /**
   * Creates a new Inceptum App
   */
  constructor(options: AppOptions = {}) {
    LogManager.setAppName(this.appName);
    const {config = new Config(), logger = LogManager.getLogger()} = options;
    this.logger = logger;
    this.context = new Context(config.getConfig('app.context.name', 'BaseContext'), null, options);
    this.context.registerDefinition(new PreinstantiatedSingletonDefinition(LogManager));
  }

  public use(...plugins: PluginImplemenation[]) {
    return this.register(...plugins);
  }

  public addDirectory(path) {
    return this.getContext().registerSingletonsInDir(path);
  }

  public register(...plugins: PluginImplemenation[]) {
    if (this.context.getStatus() !== LifecycleState.NOT_STARTED) {

      throw new Error(
        `Cannot register plugin(s) ${plugins
          .map((p) => p.name)
          .join(',')} as the app has already started. Please register all plugins before calling "start()"`,
      );
    }
    this.plugins = this.plugins.concat(plugins);
  }

  private runLifecycleMethodOnPlugins(method: PluginLifecycleMethodName) {
    return this.plugins.reduce(async (previous, plugin) => {
      await previous;
      if (plugin[method]) {
        this.logger.debug(`${method}:${plugin.name}`);
        return plugin[method](this, this.pluginContext);
      }
      return Promise.resolve();
    }, Promise.resolve());
  }

  async start() {
    await this.runLifecycleMethodOnPlugins('willStart');
    process.on('SIGINT', () => {
      this.stop().then(() => process.exit());
    });
    await this.context.lcStart();
    return await this.runLifecycleMethodOnPlugins('didStart');
  }
  async stop() {
    await this.runLifecycleMethodOnPlugins('willStop');
    this.logger.info('Shutting down app');
    await this.context.lcStop();
    return await this.runLifecycleMethodOnPlugins('didStop');
  }

  getContext(): Context {
    return this.context;
  }
  // tslint:disable-next-line:prefer-function-over-method
  getConfig(key, defaultValue): any {
    return this.getContext().getConfig(key, defaultValue);
  }
  // tslint:disable-next-line:prefer-function-over-method
  hasConfig(key): boolean {
    return this.getContext().hasConfig(key);
  }
}
