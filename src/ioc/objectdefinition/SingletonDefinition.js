const { IoCException } = require('./../IoCException');
const { ObjectDefinition } = require('./ObjectDefinition');
const { Lifecycle } = require('./../Lifecycle');

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
  TypeArray: 'typeArray'
};

class SingletonDefinition extends ObjectDefinition {
  constructor(clazz, name, logger) {
    super(clazz, name, logger);
    this.clazz = clazz;
    this.lazyLoading = true;
    this.instance = null;
    this.constructorArgDefinitions = [];
    this.propertiesToSetDefinitions = [];
    this.startFunctionName = null;
    this.shutdownFunctionName = null;
    this.autowireCandidate = true;
    this.context = null;
  }

  // ************************************
  // Configuration methods
  // ************************************

  constructorParamByValue(value) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.constructorArgDefinitions.push({ type: ParamTypes.Value, val: value });
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
  startFunction(startFunctionName) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    if (Object.prototype.hasOwnProperty.call(this.clazz.prototype, startFunctionName)) {
      this.startFunction = startFunctionName;
    } else {
      throw new IoCException(
        `Can't find function named ${startFunctionName} on class ${this.clazz.name}`);
    }
    return this;
  }
  shutdownFunction(shutdownFunctionName) {
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
    this.propertiesToSetDefinitions.push({ paramName,
      args: [{ type: ParamTypes.Value, val: value }] });
    return this;
  }
  setPropertyByRef(paramName, name) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({ paramName,
      args: [{ type: ParamTypes.Reference, refName: name }] });
    return this;
  }
  setPropertyByType(paramName, className) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({ paramName,
      args: [{ type: ParamTypes.Type,
        className: (typeof className === 'function' && className.name) ?
          className.name : className }] });
    return this;
  }
  setPropertyByTypeArray(paramName, className) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.propertiesToSetDefinitions.push({ paramName,
      args: [{ type: ParamTypes.TypeArray,
        className: (typeof className === 'function' && className.name) ?
          className.name : className }] });
    return this;
  }

  // ************************************
  // Get instance methods
  // ************************************

  * getInstance() {
    console.log(`Getting instance of ${this.getName()}`);
    const postLoad = new Set();
    const instance = yield* this.getInstanceWithTrace([this.getName()], postLoad);
    for (const dd of postLoad) {
      yield* dd.getInstance();
    }
    return instance;
  }

  * getInstanceWithTrace(trace, postLoad) {
    return yield* this.getInstanceAtState(Lifecycle.STATES.STARTED, trace, postLoad);
  }

  * getInstanceAtState(minState, trace, postLoad) {
    console.log(`Getting instance of ${this.getName()} at state ${Lifecycle.STATES.fromValue(minState)}`);
    if (minState !== Lifecycle.STATES.INSTANTIATED && minState !== Lifecycle.STATES.STARTED) {
      throw new IoCException(`Doesn't make sense to request an object in states other than INSTANTIATED and STARTED: ${minState}`);
    }
    if (this.status >= Lifecycle.STATES.STOPPING) {
      throw new IoCException(`Object ${this.getName()} is stopping. Can't give it to you`);
    }
    if (this.status === Lifecycle.STATES.INSTANTIATING) {
      throw new IoCException(`Circular dependency detected. Can't instantiate ${this.getName()}`);
    }
    if (minState <= this.status) {  // We're ready, just return it
      return this.instance;
    }
    if (this.status < Lifecycle.STATES.INSTANTIATING) {
      yield* this.instantiate(trace, postLoad);
    }
    // The object is, at least, instantiated.
    if (minState === Lifecycle.STATES.INSTANTIATED) {
      return this.instance;
    }
    // Then the minState is Started. Let's finish up then
    yield* this.setAllProperties(trace, postLoad);
    yield* this.lcStart();
    return this.instance;
  }

  // ************************************
  // Lifecycle methods
  // ************************************

  * doStart() {
    if (this.startFunctionName) {
      const resp = this.clazz.prototype[this.startFunctionName].call(this.instance);
      if (resp != null && typeof resp[Symbol.iterator] === 'function') {
        yield* resp;
      } else {
        return resp;
      }
    }
    return true;
  }

  * doStop() {
    if (this.shutdownFunctionName) {
      const resp = this.clazz.prototype[this.shutdownFunctionName].call(this.instance);
      if (resp != null && typeof resp[Symbol.iterator] === 'function') {
        yield* resp;
      } else {
        return resp;
      }
    }
    return true;
  }

  * instantiate(trace, postLoad) {
    if (!this.context) {
      throw new IoCException(`ObjectDefinition ${this.getName()} hasn't been added to a context, Can't instantiate`);
    }
    this.setStatus(Lifecycle.STATES.INSTANTIATING);
    const constructorArgs = yield* this.resolveArgs(this.constructorArgDefinitions, trace, postLoad);
    this.instance = Reflect.construct(this.clazz, constructorArgs);
    this.setStatus(Lifecycle.STATES.INSTANTIATED);
  }

  * getMaxStateInstance(def, trace, postLoad) {
    console.log(`In ${this.getName()} getting max instance of ${def.getName()} - ${def.status} - ${Lifecycle.STATES.STARTED} / trace: [${trace}]`);
    if ((trace.indexOf(def.getName()) >= 0) || (def.status < Lifecycle.STATES.STARTED)) {
      // Circular reference, let's try to go for one that is just instantiated and finalise init afterwards
      postLoad.add(def);
      console.log(`Getting ${def.getName()} as Instantiated`);
      return yield* def.getInstanceAtState(Lifecycle.STATES.INSTANTIATED, trace.concat([def.getName()]), postLoad);
    }
    console.log(`Getting ${def.getName()} as ready`);
    return yield* def.getInstanceWithTrace(trace.concat([def.getName()]), postLoad);
  }

  * resolveArgs(constructorArgs, trace, postLoad) {
    const args = [];
    for (let i = 0; i < constructorArgs.length; i++) {
      const arg = constructorArgs[i];
      switch (arg.type) {
        case ParamTypes.Value:
          args.push(arg.val);
          break;
        case ParamTypes.Reference:
          {
            const def = this.context.getDefinitionByName(arg.refName);
            args.push(yield* this.getMaxStateInstance(def, trace, postLoad));
          }
          break;
        case ParamTypes.Type:
          {
            const def = this.context.getDefinitionByType(arg.className);
            args.push(yield* this.getMaxStateInstance(def, trace, postLoad));
          }
          break;
        case ParamTypes.TypeArray:
          {
            const argu = [];
            const def = this.context.getDefinitionsByType(arg.className);
            for (let j = 0; j < def.length; j++) {
              argu.push(yield* this.getMaxStateInstance(def[j], trace, postLoad));
            }
            args.push(argu);
          }
          break;
        default:
          throw new IoCException(`Unknown argument type ${arg.type} on bean ${this.name}`);
      }
    }
    return args;
  }

  * setAllProperties() {
    for (let i = 0; i < this.propertiesToSetDefinitions.length; i++) {
      const propertyToSet = this.propertiesToSetDefinitions[i];
      const args = yield* this.resolveArgs(propertyToSet.args, [this.getName()], new Set());
      this.instance[propertyToSet.paramName] = args[0];
    }
  }
}

SingletonDefinition.ParamTypes = ParamTypes;

module.exports = { SingletonDefinition };
