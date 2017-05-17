import { LogManager } from '../../log/LogManager';
import { PromiseUtil } from '../../util/PromiseUtil';
import { IoCException } from '../IoCException';
import { Lifecycle, LifecycleState } from '../Lifecycle';
import { SingletonDefinition } from './SingletonDefinition';
import { ObjectDefinition } from './ObjectDefinition';

export class BaseSingletonState extends LifecycleState {
  public static INSTANTIATING = new BaseSingletonState('INSTANTIATING', 100);
  public static INSTANTIATED = new BaseSingletonState('INSTANTIATED', 200);
  public static PROPERTIES_SET = new BaseSingletonState('PROPERTIES_SET', 400);
}

export enum ParamType {
  Value, // = 'value',
  Reference, // = 'ref',
  Type, // = 'type',
  TypeArray, // = 'typeArray',
  Config, // = 'config',
}

class ParamDefinition {
  static withValue(val: any): ParamDefinition {
    const resp = new ParamDefinition(ParamType.Value);
    resp.val = val;
    return resp;
  }
  static withConfigKey(key: string): ParamDefinition {
    const resp = new ParamDefinition(ParamType.Config);
    resp.key = key;
    return resp;
  }
  static withRefName(refName: string): ParamDefinition {
    const resp = new ParamDefinition(ParamType.Reference);
    resp.refName = refName;
    return resp;
  }
  static withClassName(className: string): ParamDefinition {
    const resp = new ParamDefinition(ParamType.Type);
    resp.className = className;
    return resp;
  }
  static withClassNameArr(className: string): ParamDefinition {
    const resp = new ParamDefinition(ParamType.TypeArray);
    resp.className = className;
    return resp;
  }

  public className: string;
  public refName: string;
  public type: ParamType;
  public val: any;
  public key: string;

  constructor(type: ParamType) {
    this.type = type;
  }
}

class CallDefinition {
  public paramName: string;
  public args: ParamDefinition[] = [];

  constructor(paramName: string, paramDefinition: ParamDefinition) {
    this.paramName = paramName;
    this.args.push(paramDefinition);
  }
}

export class BaseSingletonDefinition<T> extends SingletonDefinition<T> {

  private static getMaxStateInstance(def, trace, postLoad: Set<ObjectDefinition<any>>) {
    // console.log(`In ${this.getName()} getting max instance of ${def.getName()} - ${def.status} - ${BaseSingletonState.STARTED} / trace: [${trace}]`);
    if ((trace.indexOf(def.getName()) >= 0) || (def.status < BaseSingletonState.STARTED)) {
      // Circular reference, let's try to go for one that is just instantiated and finalise init afterwards
      postLoad.add(def);
      // console.log(`Getting ${def.getName()} as Instantiated`);
      return def.getInstanceAtState(BaseSingletonState.INSTANTIATED, trace.concat([def.getName()]), postLoad);
    }
    // console.log(`Getting ${def.getName()} as ready`);
    return def.getInstanceWithTrace(trace.concat([def.getName()]), postLoad);
  }


  private startFunctionName: string;
  private shutdownFunctionName: string;
  private constructorArgDefinitions: ParamDefinition[] = [];
  private propertiesToSetDefinitions: CallDefinition[] = [];

  constructor(clazz, name?, logger?) {
    super(clazz, name, logger || LogManager.getLogger(__filename));
    this.propertiesToSetDefinitions = [];
    this.startFunctionName = null;
    this.shutdownFunctionName = null;
  }

  // ************************************
  // Configuration methods
  // ************************************

  constructorParamByValue(value) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.constructorArgDefinitions.push(ParamDefinition.withValue(value));
    return this;
  }

  constructorParamByConfig(key: string) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.constructorArgDefinitions.push(ParamDefinition.withConfigKey(key));
    return this;
  }

  constructorParamByRef(name) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.constructorArgDefinitions.push(ParamDefinition.withRefName(name));
    return this;
  }

  constructorParamByType(clazz) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.constructorArgDefinitions.push(ParamDefinition.withClassName(clazz));
    return this;
  }

  constructorParamByTypeArray(clazz) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.constructorArgDefinitions.push(ParamDefinition.withClassNameArr(clazz));
    return this;
  }

  startFunction(startFunctionName) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    if (Object.prototype.hasOwnProperty.call(this.clazz.prototype, startFunctionName)) {
      this.startFunctionName = startFunctionName;
    } else {
      throw new IoCException(
        `Can't find function named ${startFunctionName} on class ${this.clazz.name}`);
    }
    return this;
  }

  stopFunction(shutdownFunctionName) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    if (Object.prototype.hasOwnProperty.call(this.clazz.prototype, shutdownFunctionName)) {
      this.shutdownFunctionName = shutdownFunctionName;
    } else {
      throw new IoCException(
        `Can't find function named ${shutdownFunctionName} on class ${this.clazz.name}`);
    }
    return this;
  }

  setPropertyByValue(paramName, value) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withValue(value)));
    return this;
  }

  setPropertyByConfig(paramName, key) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withConfigKey(key)));
    return this;
  }

  setPropertyByRef(paramName, name) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withRefName(name)));
    return this;
  }

  setPropertyByType(paramName, className) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withClassName((typeof className === 'function' && className.name) ?
          className.name : className)));
    return this;
  }

  setPropertyByTypeArray(paramName, className) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withClassNameArr((typeof className === 'function' && className.name) ?
          className.name : className)));
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
        PromiseUtil.map(Array.from(postLoad.values()), (d) => d.getInstance())
          .then(() => instance));
  }

  getInstanceWithTrace(trace, postLoad) {
    return this.getInstanceAtState(BaseSingletonState.STARTED, trace, postLoad);
  }

  getInstanceAtState(minState: BaseSingletonState, trace, postLoad): Promise<T> {
    // console.log(`Getting instance of ${this.getName()} at state ${BaseSingletonState.fromValue(minState)}`);
    if (minState !== BaseSingletonState.INSTANTIATED && minState !== BaseSingletonState.STARTED) {
      return Promise.reject(new IoCException(`Doesn't make sense to request an object in states other than INSTANTIATED and STARTED: ${minState}`));
    }
    if (this.status.isAtOrAfter(BaseSingletonState.STOPPING)) {
      return Promise.reject(new IoCException(`Object ${this.getName()} is stopping. Can't give it to you`));
    }
    if (this.status === BaseSingletonState.INSTANTIATING) {
      return Promise.reject(new IoCException(`Circular dependency detected. Can't instantiate ${this.getName()}`));
    }
    if (minState.isAtOrBefore(this.status)) {  // We're ready, just return it
      return Promise.resolve(this.instance);
    }
    let basePromise;
    if (this.status.isBefore(BaseSingletonState.INSTANTIATING)) {
      basePromise = this.instantiate(trace, postLoad);
    } else {
      basePromise = Promise.resolve();
    }
    // The object is, at least, instantiated.
    if (minState === BaseSingletonState.INSTANTIATED) {
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

  protected doStart(): Promise<void> {
    if (this.startFunctionName) {
      const resp = this.clazz.prototype[this.startFunctionName].call(this.instance);
      if (resp && resp.then) {
        return resp;
      }
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  protected doStop(): Promise<void> {
    if (this.shutdownFunctionName) {
      const resp = this.clazz.prototype[this.shutdownFunctionName].call(this.instance);
      if (resp && resp.then) {
        return resp;
      }
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  protected resolveArgs(constructorArgs, trace, postLoad: Set<ObjectDefinition<any>>): Promise<any[]> {
    return PromiseUtil.map(constructorArgs, (arg) => {
      switch (arg.type) {
        case ParamType.Value:
          return arg.val;
        case ParamType.Config:
          return this.context.getConfig(arg.key);
        case ParamType.Reference:
          return BaseSingletonDefinition.getMaxStateInstance(
            this.context.getDefinitionByName(arg.refName),
            trace,
            postLoad);
        case ParamType.Type:
          return BaseSingletonDefinition.getMaxStateInstance(
            this.context.getDefinitionByType(arg.className),
            trace,
            postLoad);
        case ParamType.TypeArray:
          return Promise.all(
            this.context.getDefinitionsByType(arg.className).map(
              (d) => BaseSingletonDefinition.getMaxStateInstance(d, trace, postLoad)));
        default:
          return Promise.reject(new IoCException(`Unknown argument type ${arg.type} on bean ${this.name}`));
      }
    });
  }

  public getCopyInstance(): ObjectDefinition<T> {
    return new BaseSingletonDefinition<T>(this.clazz, this.name, this.logger);
  }

  protected copyInternalProperties(copyTo) {
    super.copyInternalProperties(copyTo);
    copyTo.constructorArgDefinitions = this.constructorArgDefinitions.slice(0);
    copyTo.propertiesToSetDefinitions = this.propertiesToSetDefinitions.slice(0);
    copyTo.startFunctionName = this.startFunctionName;
    copyTo.shutdownFunctionName = this.shutdownFunctionName;
  }

  private instantiate(trace, postLoad): Promise<T> {
    if (!this.context) {
      return Promise.reject(new IoCException(`ObjectDefinition ${this.getName()} hasn't been added to a context, Can't instantiate`));
    }
    this.setStatus(BaseSingletonState.INSTANTIATING);
    return this.resolveArgs(this.constructorArgDefinitions, trace, postLoad)
      .then((constructorArgs) => {
        this.instance = Reflect.construct(this.clazz, constructorArgs);
        this.setStatus(BaseSingletonState.INSTANTIATED);
        return this.instance;
      });
  }
  private setAllProperties(trace, postload) {
    return PromiseUtil.map(this.propertiesToSetDefinitions, (propertyToSet: CallDefinition) =>
      this.resolveArgs(propertyToSet.args, trace, postload).then((args) => {
        this.instance[propertyToSet.paramName] = args[0];
      }));
  }

}
