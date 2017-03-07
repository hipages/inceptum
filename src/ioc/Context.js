// Shutdown order
// Factory beans
// Profile support

const fs = require('fs');
const path = require('path');
const config = require('config');
const LogManager = require('../log/LogManager');
const { Lifecycle } = require('./Lifecycle');
const { IoCException } = require('./IoCException');
const { ObjectDefinition } = require('./objectdefinition/ObjectDefinition');
const { BaseSingletonDefinition } = require('./objectdefinition/BaseSingletonDefinition');
const { ObjectDefinitionInspector } = require('./ObjectDefinitionInspector');

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

  * lcStart() {
    if (this.parentContext) {
      yield* this.parentContext.lcStart();
    }
    yield* super.lcStart();
  }

  * lcStop() {
    yield* super.lcStop();
    if (this.parentContext) {
      yield* this.parentContext.lcStop();
    }
  }

  * doStart() {
    this.applyObjectDefinitionModifiers();
    const nonLazyObjectsPending = new Set();
    for (const objectDefinition of this.objectDefinitions.values()) {
      if (!objectDefinition.isLazy()) {
        try {
          nonLazyObjectsPending.add(objectDefinition.getName());
          objectDefinition.onStateOnce(Lifecycle.STATES.STARTED, () => nonLazyObjectsPending.delete(objectDefinition.getName()));
          yield* objectDefinition.getInstance();
        } catch (e) {
          if (this.getLogger()) {
            this.getLogger().error(
              `There was an error starting context. Object "${objectDefinition.getName()}" threw an exception during startup. Stopping context`, e);
          }
          // this.emit('error',
          //  `There was an error starting context. Object "${objectDefinition.getName()}" threw an exception during startup. Stopping context`, e);
          yield this.lcStop();
          throw e;
        }
      }
    }
    return nonLazyObjectsPending.size === 0;
  }

  * doStop() {
    for (const startedObject of this.startedObjects.values()) {
      yield* startedObject.lcStop();
    }
    return this.startedObjects.size === 0;
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

  /**
   *
   * @param dir
   * @param filelist
   * @return {Array}
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

  static getConfig(key) {
    return config.get(key);
  }

  getConfig(key) {
    return Context.getConfig(key);
  }

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

  * getObjectByName(beanName) {
    const beanDefinition = this.getDefinitionByName(beanName);
    return yield* beanDefinition.getInstance();
  }

  * getObjectByType(className) {
    const beanDefinition = this.getDefinitionByType(className);
    return yield* beanDefinition.getInstance();
  }

  * getObjectsByType(className) {
    const beanDefinitions = this.getDefinitionsByType(className);
    const resp = [];
    for (let i = 0; i < beanDefinitions.length; i++) {
      resp.push(yield* beanDefinitions[i].getInstance());
    }
    return resp;
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
