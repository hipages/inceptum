// Shutdown order
// Factory beans
// Profile support

const fs = require('fs');
const path = require('path');
const config = require('config');
const LogManager = require('../log/LogManager');
const { Lifecycle } = require('./Lifecycle');
const { IoCException } = require('./IoCException');
const { PromiseUtil } = require('../util/PromiseUtil');
const { ObjectDefinition } = require('./objectdefinition/ObjectDefinition');
const { BaseSingletonDefinition } = require('./objectdefinition/BaseSingletonDefinition');
const { ObjectDefinitionInspector } = require('./ObjectDefinitionInspector');

/**
 * A context used by IoC to register and request objects from.
 * This is the main class for the inversion of control framework. It serves as a registry where you can
 * add {ObjectDefinition}s and request instances from them.
 */
class Context extends Lifecycle {
  constructor(name, parentContext, logger) {
    super(name, logger || LogManager.getLogger(__filename));
    this.parentContext = parentContext;
    this.objectDefinitions = new Map();
    this.startedObjects = new Map();
    this.objectDefinitionInspector = [];
  }

  // ************************************
  // Lifecycle related methods
  // ************************************

  lcStart() {
    if (this.parentContext) {
      return this.parentContext.lcStart()
        .then(() => super.lcStart());
    }
    return super.lcStart();
  }

  lcStop() {
    const stopPromise = super.lcStop();
    if (this.parentContext) {
      return stopPromise.then(() => this.parentContext.lcStop());
    }
    return stopPromise;
  }

  doStart() {
    this.applyObjectDefinitionModifiers();
    this.nonLazyObjectsPending = new Set();
    return PromiseUtil.map(Array.from(this.objectDefinitions.values()).filter((o) => !o.isLazy()), (objectDefinition) => {
      this.nonLazyObjectsPending.add(objectDefinition.getName());
      objectDefinition.onStateOnce(Lifecycle.STATES.STARTED, () => this.nonLazyObjectsPending.delete(objectDefinition.getName()));
      return objectDefinition.getInstance();
    }).catch((err) => {
      this.getLogger().error(
        { err },
        'There was an error starting context. At least one non-lazy object threw an exception during startup. Stopping context'
      );
      return this.lcStop().then(() => { throw err; });
    }).then(() => (this.nonLazyObjectsPending.size === 0));
  }

  doStop() {
    return PromiseUtil.map(Array.from(this.startedObjects.values()), (startedObject) => startedObject.lcStop())
      .then(() => (this.startedObjects.size === 0));
  }

  // ************************************
  // Context composition methods
  // ************************************

  clone(name) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    const copy = new Context(name, this.parentContext, this.logger);
    this.objectDefinitions.forEach((objectDefinition) => copy.registerDefinition(objectDefinition.copy()));
    return copy;
  }

  importContext(otherContext, overwrite = false) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    otherContext.assertState(Lifecycle.STATES.NOT_STARTED);
    otherContext.objectDefinitions.forEach((objectDefinition) => this.registerDefinition(objectDefinition, overwrite));
  }

  // ************************************
  // Object Definition inspector methods
  // ************************************

  addObjectDefinitionInspector(inspector) {
    if (!inspector || !(inspector instanceof ObjectDefinitionInspector)) {
      throw new IoCException(`Provided modifier is not of type ${ObjectDefinitionInspector.name}. It's a ${typeof inspector}`);
    }
    this.objectDefinitionInspector.push(inspector);
  }

  // ************************************
  // Object Definition registration methods
  // ************************************

  registerDefinition(objectDefinition, overwrite = false) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    if (!(objectDefinition instanceof ObjectDefinition)) {
      throw new IoCException('Provided input for registration is not an instance of ObjectDefinition');
    }
    if (!overwrite && this.objectDefinitions.has(objectDefinition.getName())) {
      throw new IoCException(`Object definition with name ${objectDefinition.getName()} already exists in this context`);
    }
    if (this.parentContext && this.parentContext.objectDefinitions.has(objectDefinition.getName())) {
      throw new IoCException(`Parent context already has an object definition with name ${objectDefinition.getName()}`);
    }
    this.objectDefinitions.set(objectDefinition.getName(), objectDefinition);
    objectDefinition.setContext(this);
    objectDefinition.onStateOnce(Lifecycle.STATES.STARTED, () => this.startedObjects.set(objectDefinition.getName(), objectDefinition));
    objectDefinition.onStateOnce(Lifecycle.STATES.STOPPED, () => this.startedObjects.delete(objectDefinition.getName()));
  }

  registerSingletons(...singletons) {
    singletons.forEach((singleton) => {
      if (singleton instanceof ObjectDefinition) {
        this.registerDefinition(singleton);
      } else if (singleton instanceof Function) {
        this.registerDefinition(new BaseSingletonDefinition(singleton));
      } else {
        throw new IoCException(
          `Not sure how to convert input into SingletonDefinition: ${singleton}`);
      }
    });
  }

  registerSingletonsInDir(dir) {
    Context.walkDirSync(dir).filter(file => path.extname(file) === '.js').forEach(file => {
      let expectedClass = path.basename(file);
      expectedClass = expectedClass.substr(0, expectedClass.length - 3);
      // eslint-disable-next-line global-require
      const loaded = require(file);
      if (loaded) {
        if ((typeof loaded === 'object') && !(loaded instanceof Function) && loaded[expectedClass] && loaded[expectedClass].constructor) {
          this.registerSingletons(loaded[expectedClass]);
        } else if (loaded instanceof Function && loaded.name && loaded.name === expectedClass) {
          this.registerSingletons(loaded);
        } else {
          throw new IoCException(`Couldn't register singleton for ${file}`);
        }
      }
    });
  }

  requireFilesInDir(dir) {
    Context.walkDirSync(dir).filter(file => path.extname(file) === '.js').forEach(file => {
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
    fs.readdirSync(dir).forEach(file => {
      filelist = fs.statSync(path.join(dir, file)).isDirectory()
        ? Context.walkDirSync(path.join(dir, file), filelist)
        : filelist.concat(path.join(dir, file));
    });
    return filelist;
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
  static getConfig(key, defaultValue) {
    if (!config.has(key) && defaultValue !== undefined) {
      return defaultValue;
    }
    return config.get(key);
  }

  getConfig(key) {
    return Context.getConfig(key);
  }

  /**
   * Indicates whether a given key exists in the configuration
   * @param key
   * @return {*}
   */
  static hasConfig(key) {
    return config.has(key);
  }

  hasConfig(key) {
    return Context.hasConfig(key);
  }

  static getConfigSources() {
    return config.util.getConfigSources();
  }

  // ************************************
  // Get Bean Functions
  // ************************************

  getObjectByName(beanName) {
    const beanDefinition = this.getDefinitionByName(beanName);
    return beanDefinition.getInstance();
  }

  getObjectByType(className) {
    const beanDefinition = this.getDefinitionByType(className);
    return beanDefinition.getInstance();
  }

  getObjectsByType(className) {
    const beanDefinitions = this.getDefinitionsByType(className);
    const instances = PromiseUtil.map(beanDefinitions, bd => bd.getInstance());
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

  // ************************************
  // Get Bean Definition Functions
  // ************************************

  getDefinitionByName(objectName) {
    const val = this.objectDefinitions.get(objectName);
    if (val) return val;
    if (this.parentContext) {
      return this.parentContext.getDefinitionByName(objectName);
    }
    throw new IoCException(`No object definition with name ${objectName} registered in the context`);
  }

  getDefinitionByType(className) {
    const resp = this.getDefinitionsByType(className);
    if (resp.length > 1) {
      throw new IoCException(
        `Found more than one object definition in the context that produces a ${className}`);
    }
    return resp[0];
  }

  getDefinitionsByType(className, failOnMissing = true) {
    const resp = new Map();
    if (this.parentContext) {
      this.parentContext.getDefinitionsByType(className, false).forEach(
        (objectDefinition) => resp.set(objectDefinition.getName(), objectDefinition));
    }
    this.objectDefinitions.forEach((objectDefinition) => {
      if ((objectDefinition.getProducedClass().name === className) && objectDefinition.autowireCandidate) {
        resp.set(objectDefinition.getName(), objectDefinition);
      }
    });
    if (resp.size === 0 && failOnMissing) {
      throw new IoCException(`Couldn't find a bean that produces class ${className}`);
    }
    return Array.from(resp.values());
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

module.exports = { Context };
