const { IoCException } = require('./../IoCException');
const { SingletonDefinition } = require('./SingletonDefinition');
const { Lifecycle } = require('./../Lifecycle');
const LogManager = require('../../log/LogManager');

// Means resolving the constructor arguments necessary to instantiate
Lifecycle.registerState('INSTANTIATING', 100);
// It was instantiated
Lifecycle.registerState('INSTANTIATED', 200);
// The properties were resolved
Lifecycle.registerState('PROPERTIES_SET', 400);
// The custom init method will be called with the Start process

const ParamTypes = {
  Value: 'value',
  Reference: 'ref',
  Type: 'type',
  TypeArray: 'typeArray',
  Config: 'config'
};

class BaseSingletonDefinition extends SingletonDefinition {
  constructor(clazz, name, logger) {
    super(clazz, name, logger || LogManager.getLogger(__filename));
    this.constructorArgDefinitions = [];
    this.propertiesToSetDefinitions = [];
    this.startFunctionName = null;
    this.shutdownFunctionName = null;
  }

  // ************************************
  // Configuration methods
  // ************************************

  constructorParamByValue(value) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.constructorArgDefinitions.push({ type: ParamTypes.Value, val: value });
    return this;
  }

  constructorParamByConfig(key) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.constructorArgDefinitions.push({ type: ParamTypes.Config, key });
    return this;
  }

  constructorParamByRef(name) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.constructorArgDefinitions.push({ type: ParamTypes.Reference, refName: name });
    return this;
  }

  constructorParamByType(clazz) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.constructorArgDefinitions.push({ type: ParamTypes.Type, className: clazz });
    return this;
  }

  constructorParamByTypeArray(clazz) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.constructorArgDefinitions.push({ type: ParamTypes.TypeArray, className: clazz });
    return this;
  }

  startFunction(startFunctionName) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    if (Object.prototype.hasOwnProperty.call(this.clazz.prototype, startFunctionName)) {
      this.startFunctionName = startFunctionName;
    } else {
      throw new IoCException(
        `Can't find function named ${startFunctionName} on class ${this.clazz.name}`);
    }
    return this;
  }

  stopFunction(shutdownFunctionName) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    if (Object.prototype.hasOwnProperty.call(this.clazz.prototype, shutdownFunctionName)) {
      this.shutdownFunctionName = shutdownFunctionName;
    } else {
      throw new IoCException(
        `Can't find function named ${shutdownFunctionName} on class ${this.clazz.name}`);
    }
    return this;
  }

  setPropertyByValue(paramName, value) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({
      paramName,
      args: [{ type: ParamTypes.Value, val: value }]
    });
    return this;
  }

  setPropertyByConfig(paramName, key) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({
      paramName,
      args: [{ type: ParamTypes.Config, key }]
    });
    return this;
  }

  setPropertyByRef(paramName, name) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({
      paramName,
      args: [{ type: ParamTypes.Reference, refName: name }]
    });
    return this;
  }

  setPropertyByType(paramName, className) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({
      paramName,
      args: [{
        type: ParamTypes.Type,
        className: (typeof className === 'function' && className.name) ?
          className.name : className
      }]
    });
    return this;
  }

  setPropertyByTypeArray(paramName, className) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({
      paramName,
      args: [{
        type: ParamTypes.TypeArray,
        className: (typeof className === 'function' && className.name) ?
          className.name : className
      }]
    });
    return this;
  }

  // ************************************
  // Get instance methods
  // ************************************

  getInstance() {
    // console.log(`Getting instance of ${this.getName()}`);
    const postLoad = new Set();
    return this.getInstanceWithTrace([this.getName()], postLoad)
      .then((instance) =>
        Promise.map(Array.from(postLoad.values()), (d) => d.getInstance())
          .then(() => instance));
  }

  getInstanceWithTrace(trace, postLoad) {
    return this.getInstanceAtState(Lifecycle.STATES.STARTED, trace, postLoad);
  }

  getInstanceAtState(minState, trace, postLoad) {
    // console.log(`Getting instance of ${this.getName()} at state ${Lifecycle.STATES.fromValue(minState)}`);
    if (minState !== Lifecycle.STATES.INSTANTIATED && minState !== Lifecycle.STATES.STARTED) {
      return Promise.reject(new IoCException(`Doesn't make sense to request an object in states other than INSTANTIATED and STARTED: ${minState}`));
    }
    if (this.status >= Lifecycle.STATES.STOPPING) {
      return Promise.reject(new IoCException(`Object ${this.getName()} is stopping. Can't give it to you`));
    }
    if (this.status === Lifecycle.STATES.INSTANTIATING) {
      return Promise.reject(new IoCException(`Circular dependency detected. Can't instantiate ${this.getName()}`));
    }
    if (minState <= this.status) {  // We're ready, just return it
      return Promise.resolve(this.instance);
    }
    let basePromise;
    if (this.status < Lifecycle.STATES.INSTANTIATING) {
      basePromise = this.instantiate(trace, postLoad);
    } else {
      basePromise = Promise.resolve();
    }
    // The object is, at least, instantiated.
    if (minState === Lifecycle.STATES.INSTANTIATED) {
      return basePromise.then(() => this.instance);
    }
    // Then the minState is Started. Let's finish up then
    return basePromise
      .then(() => this.setAllProperties(trace, postLoad))
      .then(() => this.lcStart())
      .then(() => this.instance);
  }

  // ************************************
  // Lifecycle methods
  // ************************************

  doStart() {
    if (this.startFunctionName) {
      const resp = this.clazz.prototype[this.startFunctionName].call(this.instance);
      if (resp.then) {
        return resp.then(true);
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(true);
  }

  doStop() {
    if (this.shutdownFunctionName) {
      const resp = this.clazz.prototype[this.shutdownFunctionName].call(this.instance);
      if (resp.then) {
        return resp.then(true);
      }
      return Promise.resolve(true);
    }
    return Promise.resolve(true);
  }

  instantiate(trace, postLoad) {
    if (!this.context) {
      return Promise.reject(new IoCException(`ObjectDefinition ${this.getName()} hasn't been added to a context, Can't instantiate`));
    }
    this.setStatus(Lifecycle.STATES.INSTANTIATING);
    return this.resolveArgs(this.constructorArgDefinitions, trace, postLoad)
      .then((constructorArgs) => {
        this.instance = Reflect.construct(this.clazz, constructorArgs);
        this.setStatus(Lifecycle.STATES.INSTANTIATED);
        return this.instance;
      });
  }

  getMaxStateInstance(def, trace, postLoad) {
    // console.log(`In ${this.getName()} getting max instance of ${def.getName()} - ${def.status} - ${Lifecycle.STATES.STARTED} / trace: [${trace}]`);
    if ((trace.indexOf(def.getName()) >= 0) || (def.status < Lifecycle.STATES.STARTED)) {
      // Circular reference, let's try to go for one that is just instantiated and finalise init afterwards
      postLoad.add(def);
      // console.log(`Getting ${def.getName()} as Instantiated`);
      return def.getInstanceAtState(Lifecycle.STATES.INSTANTIATED, trace.concat([def.getName()]), postLoad);
    }
    // console.log(`Getting ${def.getName()} as ready`);
    return def.getInstanceWithTrace(trace.concat([def.getName()]), postLoad);
  }

  resolveArgs(constructorArgs, trace, postLoad) {
    return Promise.map(constructorArgs, (arg) => {
      switch (arg.type) {
        case ParamTypes.Value:
          return arg.val;
        case ParamTypes.Config:
          return this.context.getConfig(arg.key);
        case ParamTypes.Reference:
          return this.getMaxStateInstance(
            this.context.getDefinitionByName(arg.refName),
            trace,
            postLoad);
        case ParamTypes.Type:
          return this.getMaxStateInstance(
            this.context.getDefinitionByType(arg.className),
            trace,
            postLoad);
        case ParamTypes.TypeArray:
          return Promise.all(
            this.context.getDefinitionsByType(arg.className),
            (d) => this.getMaxStateInstance(d, trace, postLoad)
          );
        default:
          return Promise.reject(new IoCException(`Unknown argument type ${arg.type} on bean ${this.name}`));
      }
    });
  }

  setAllProperties(trace, postload) {
    return Promise.map(this.propertiesToSetDefinitions, (propertyToSet) =>
      this.resolveArgs(propertyToSet.args, trace, postload).then((args) => {
        this.instance[propertyToSet.paramName] = args[0];
      })
    );
  }

  copy() {
    const theCopy = new BaseSingletonDefinition(this.clazz, this.name, this.logger);
    this.copyInternalProperties(theCopy);
    return theCopy;
  }

  copyInternalProperties(copyTo) {
    super.copyInternalProperties(copyTo);
    copyTo.constructorArgDefinitions = this.constructorArgDefinitions.slice(0);
    copyTo.propertiesToSetDefinitions = this.propertiesToSetDefinitions.slice(0);
    copyTo.startFunctionName = this.startFunctionName;
    copyTo.shutdownFunctionName = this.shutdownFunctionName;
  }

}
BaseSingletonDefinition.ParamTypes = ParamTypes;

module.exports = { BaseSingletonDefinition };
