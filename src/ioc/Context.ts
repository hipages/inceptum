// Shutdown order
// Factory beans
// Profile support

import * as fs from 'fs';
import * as path from 'path';
import * as globby from 'globby';
import Config, { ConfigAdapter } from '../config/ConfigProvider';
import { Logger, LogManager } from '../log/LogManager';
import { PromiseUtil } from '../util/PromiseUtil';
import { Lifecycle, LifecycleState } from './Lifecycle';
import { IoCException } from './IoCException';
import { ObjectDefinition } from './objectdefinition/ObjectDefinition';
import { BaseSingletonDefinition } from './objectdefinition/BaseSingletonDefinition';
import { ObjectDefinitionInspector } from './ObjectDefinitionInspector';
import { PreinstantiatedSingletonDefinition } from './objectdefinition/PreinstantiatedSingletonDefinition';

/**
 * A context used by IoC to register and request objects from.
 * This is the main class for the inversion of control framework. It serves as a registry where you can
 * add {ObjectDefinition}s and request instances from them.
 */

export interface ContextOptions {
  logger?: Logger,
  config?: Config,
  shutdownTimer?: number,
}

export class Context extends Lifecycle {
  private objectDefinitionInspector: ObjectDefinitionInspector[];
  private startedObjects: Map<any, any>;
  private objectDefinitions: Map<string, ObjectDefinition<any>>;
  private parentContext: Context;
  private config: Config;
  private objectGroups: Map<string, string[]>;
  private shutdownTimer: number;

  constructor(name: string, parentContext?: Context, options: ContextOptions = {}) {
    super(name, options.logger || LogManager.getLogger(__filename));
    this.config = options.config || new Config();
    this.shutdownTimer = options.shutdownTimer || 10000;
    this.parentContext = parentContext;
    this.objectDefinitions = new Map();
    this.startedObjects = new Map();
    this.objectDefinitionInspector = [];
    this.objectGroups = new Map<string, string[]>();
    this.registerDefinition(new PreinstantiatedSingletonDefinition(this, '__CONTEXT__'));
  }

  // ************************************
  // Lifecycle related methods
  // ************************************

  lcStart(): Promise<void> {
    if (this.parentContext) {
      return this.parentContext.lcStart().then(() => super.lcStart());
    }
    return super.lcStart();
  }

  lcStop(): Promise<void> {
    const stopPromise = super.lcStop();
    if (this.parentContext) {
      return stopPromise.then(() => this.parentContext.lcStop());
    }
    return stopPromise;
  }

  protected doStart(): Promise<void> {
    this.applyObjectDefinitionModifiers();
    return PromiseUtil.map(Array.from(this.objectDefinitions.values()).filter((o) => !o.isLazy()), (objectDefinition) =>
      objectDefinition.getInstance(),
    )
      .catch((err) => {
        this.getLogger().error(
          { err },
          'There was an error starting context. At least one non-lazy object threw an exception during startup. Stopping context',
        );
        return this.lcStop().then(() => {
          throw err;
        });
      })
      .then(() => {
        this.getLogger().debug(`Context ${this.getName()} started`);
      });
  }

  protected async doStop(): Promise<any> {
    this.getLogger().debug(`Waiting ${this.shutdownTimer} to stop context`);
    await PromiseUtil.sleepPromise(this.shutdownTimer);
    return PromiseUtil.map(Array.from(this.startedObjects.values()), (startedObject) =>
      startedObject.lcStop(),
    ).then(() => {
      /* donothing */
    });
  }

  // ************************************
  // Context composition methods
  // ************************************

  clone(name) {
    this.assertState(LifecycleState.NOT_STARTED);
    const copy = new Context(name, this.parentContext, { logger: this.logger, config: this.config });
    this.objectDefinitions.forEach((objectDefinition) => {
      if (objectDefinition.getName() !== '__CONTEXT__') {
        copy.registerDefinition(objectDefinition.copy());
      }
    });
    return copy;
  }

  importContext(otherContext, overwrite = false) {
    this.assertState(LifecycleState.NOT_STARTED);
    otherContext.assertState(LifecycleState.NOT_STARTED);
    otherContext.objectDefinitions.forEach((objectDefinition) => {
      if (objectDefinition.getName() !== '__CONTEXT__') {
        this.registerDefinition(objectDefinition, overwrite);
      }
    });
  }

  // ************************************
  // Object Definition inspector methods
  // ************************************

  addObjectDefinitionInspector(inspector: ObjectDefinitionInspector) {
    this.objectDefinitionInspector.push(inspector);
  }

  // ************************************
  // Object Definition registration methods
  // ************************************

  registerDefinition(objectDefinition: ObjectDefinition<any>, overwrite = false) {
    this.assertState(LifecycleState.NOT_STARTED);
    if (!(objectDefinition instanceof ObjectDefinition)) {
      throw new IoCException('Provided input for registration is not an instance of ObjectDefinition');
    }
    if (!overwrite && this.objectDefinitions.has(objectDefinition.getName())) {
      throw new IoCException(
        `Object definition with name ${objectDefinition.getName()} already exists in this context`,
      );
    }
    if (this.parentContext && this.parentContext.objectDefinitions.has(objectDefinition.getName()) && objectDefinition.getName() !== '__CONTEXT__') {
      throw new IoCException(`Parent context already has an object definition with name ${objectDefinition.getName()}`);
    }
    this.objectDefinitions.set(objectDefinition.getName(), objectDefinition);
    objectDefinition.setContext(this);
    objectDefinition.onStateOnce(LifecycleState.STARTED, () =>
      this.startedObjects.set(objectDefinition.getName(), objectDefinition),
    );
    objectDefinition.onStateOnce(LifecycleState.STOPPED, () => this.startedObjects.delete(objectDefinition.getName()));
  }

  registerSingletons(...singletons) {
    singletons.forEach((singleton) => {
      if (singleton instanceof ObjectDefinition) {
        this.registerDefinition(singleton);
      } else if (singleton instanceof Function) {
        this.registerDefinition(new BaseSingletonDefinition<any>(singleton));
        this.logger.debug(`Registering singleton ${singleton.name}`);
      } else {
        throw new IoCException(`Not sure how to convert input into SingletonDefinition: ${singleton}`);
      }
    });
  }

  registerSingletonsInDir(patterns, options) {
    Context.findMatchingFiles(patterns, options).filter((file) => ['.js', '.ts'].indexOf(path.extname(file)) >= 0).forEach((file) => {
      if (file.includes('.d.ts')) {
        return; // Ignore type definition files
      }
      let expectedClass = path.basename(file);
      expectedClass = expectedClass.substr(0, expectedClass.length - 3);
      const loaded = require(file);
      if (loaded) {
        if (typeof loaded === 'object' && loaded.__esModule && loaded.default && loaded.default.constructor) {
          this.registerSingletons(loaded.default);
        } else if (
          typeof loaded === 'object' &&
          !(loaded instanceof Function) &&
          loaded[expectedClass] &&
          loaded[expectedClass].constructor
        ) {
          this.registerSingletons(loaded[expectedClass]);
        } else if (loaded instanceof Function && loaded.name && loaded.name === expectedClass) {
          this.registerSingletons(loaded);
        } else {
          throw new IoCException(`Couldn't register singleton for ${file}`);
        }
      }
    });
  }

  static requireFilesInDir(dir) {
    Context.walkDirSync(dir).filter((file) => path.extname(file) === '.js').forEach((file) => {
      // eslint-disable-next-line global-require
      require(file);
    });
  }

  /**
   * Walks a directory recursively and returns an array with all the files
   *
   * @private
   * @param dir The directory to walk through
   * @param filelist The carried-over list of files
   * @return {Array} The list of files in this directory and subdirs
   */
  static walkDirSync(dir, filelist = []) {
    fs.readdirSync(dir).forEach((file) => {
      filelist = fs.statSync(path.join(dir, file)).isDirectory()
        ? Context.walkDirSync(path.join(dir, file), filelist)
        : filelist.concat(path.join(dir, file));
    });
    return filelist;
  }

  /**
   *  find matching files based on the given path or glob
   *
   * @param {string} patterns - glob pattern(s) or relative path
   * @param {boolean} [isGlob] - pass true to treat the path as a glob
   * @param {Object} [globOptions] - options to pass to globby
   * @returns {Array<string>} files
   */
  static findMatchingFiles(patterns: string | Array<string>, {isGlob, globOptions}: {
    isGlob: boolean,
    globOptions: Object,
  }): Array<string> {

    // Try to treat the patterns as globs first
    if (globby.hasMagic(patterns) || Array.isArray(patterns) || isGlob) {
      return globby.sync(patterns, globOptions);
    }

    // Fallback to the legacy implementation for non-glob patterns to avoid code breaks
    return Context.walkDirSync(patterns);
  }

  // ************************************
  // Config functions
  // ************************************

  /**
   * Get an element from the configuration.
   * Can be both a leaf of the configuration, or an intermediate path. In the latter case it will return
   * an object with all the configs under that path.
   * It will throw an exception if the key doesn't exist.
   *
   * @param {string} key The key of the config we want
   * @param {*} defaultValue A default value to use if the key doesn't exist
   * @return {*} The requested configuration
   * @throws {Error} If the given key doesn't exist and a default value is not provided
   * @see {@link Context.hasConfig}
   */
  getConfig(key: string, defaultValue?: any): any {
    return this.config.getConfig(key, defaultValue);
  }

  /**
   * Indicates whether a given key exists in the configuration
   * @param key
   * @return {*}
   */
  hasConfig(key: string): boolean {
    return this.config.hasConfig(key);
  }

  // ************************************
  // Group functions
  // ************************************

  addObjectNameToGroup(groupName: string, objectName: string) {
    if (!this.objectGroups.has(groupName)) {
      this.objectGroups.set(groupName, []);
    }
    this.objectGroups.get(groupName).push(objectName);
  }

  getGroupObjectNames(groupName: string): string[] {
    if (!this.objectGroups.has(groupName)) {
      return [];
    }
    return this.objectGroups.get(groupName);
  }

  // ************************************
  // Get Bean Functions
  // ************************************

  getObjectByName(beanName: string): Promise<any> {
    const beanDefinition = this.getDefinitionByName(beanName);
    return beanDefinition.getInstance();
  }

  getObjectByType(className: string): Promise<any> {
    const beanDefinition = this.getDefinitionByType(className);
    return beanDefinition.getInstance();
  }

  getObjectsByType(className: string): Promise<any[]> {
    const beanDefinitions = this.getDefinitionsByType(className);
    const instances = PromiseUtil.map(beanDefinitions, (bd) => bd.getInstance());
    return instances.then((arr) => {
      arr.sort((a, b) => {
        const aPos = Object.hasOwnProperty.call(a, 'getOrder') ? a.getOrder() : 0;
        const bPos = Object.hasOwnProperty.call(b, 'getOrder') ? b.getOrder() : 0;
        if (aPos === bPos) {
          return 0;
        } else if (aPos < bPos) {
          return -1;
        }
        return 1;
      });
      return arr;
    });
  }

   getObjectsByGroup(groupName: string): Promise<any[]> {
    const objectNames = this.getGroupObjectNames(groupName);
    const objectDefinitions = objectNames.map((objectName) => this.getDefinitionByName(objectName));
    return objectDefinitions.reduce(async (acum, def) => {
      (await acum).push(await def.getInstance());
      return Promise.resolve(acum);
    }, Promise.resolve([]));
  }

  // ************************************
  // Get Bean Definition Functions
  // ************************************

  getDefinitionByName(objectName: string): ObjectDefinition<any> {
    const val = this.objectDefinitions.get(objectName);
    if (val) {
      return val;
    }
    if (this.parentContext) {
      return this.parentContext.getDefinitionByName(objectName);
    }
    throw new IoCException(`No object definition with name ${objectName} registered in the context`);
  }

  getDefinitionByType(className: string): ObjectDefinition<any> {
    const resp = this.getDefinitionsByType(className);
    if (resp.length > 1) {
      throw new IoCException(`Found more than one object definition in the context that produces a ${className}`);
    }
    return resp[0];
  }

  getDefinitionsByType(className: string, failOnMissing = true): Array<ObjectDefinition<any>> {
    const resp = new Map();
    if (this.parentContext) {
      this.parentContext
        .getDefinitionsByType(className, false)
        .forEach((objectDefinition) => resp.set(objectDefinition.getName(), objectDefinition));
    }
    this.objectDefinitions.forEach((objectDefinition) => {
      if (objectDefinition.getProducedClass().name === className && objectDefinition.autowireCandidate) {
        resp.set(objectDefinition.getName(), objectDefinition);
      }
    });
    if (resp.size === 0 && failOnMissing) {
      throw new IoCException(`Couldn't find a bean that produces class ${className}`);
    }
    return Array.from(resp.values());
  }

  getDefinitionsByGroup(groupName: string): Array<ObjectDefinition<any>> {
    const objectNames = this.getGroupObjectNames(groupName);
    return objectNames.map((objectName) => this.getDefinitionByName(objectName));
  }

  applyObjectDefinitionModifiers() {
    // Let's allow the inspectors to modify the bean definitions
    this.objectDefinitionInspector.forEach((inspector) => {
      this.objectDefinitions.forEach((objectDefinition, key) => {
        const result = inspector.inspect(objectDefinition);
        if (result) {
          this.objectDefinitions.set(key, result);
        }
      });
    });
  }
}
