import { Context } from '../Context';
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
  Group, // = 'group',
  DefinitionGroup, // = 'group',
}

export class ParamDefinition {
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
  static withGroupName(groupName: string): ParamDefinition {
    const resp = new ParamDefinition(ParamType.Group);
    resp.group = groupName;
    return resp;
  }
  static withDefinitionGroupName(groupName: string): ParamDefinition {
    const resp = new ParamDefinition(ParamType.DefinitionGroup);
    resp.group = groupName;
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
  public group: string;
  public objectDefinitions: Array<ObjectDefinition<any>>;

  constructor(type: ParamType) {
    this.type = type;
  }
}

export class CallDefinition {
  public paramName: string;
  public args: ParamDefinition[] = [];

  constructor(paramName: string, paramDefinition: ParamDefinition) {
    this.paramName = paramName;
    this.args.push(paramDefinition);
  }
}

export abstract class ConfigurableSingletonDefinition<T> extends SingletonDefinition<T> {
  private constructorArgDefinitions: ParamDefinition[] = [];
  private propertiesToSetDefinitions: CallDefinition[] = [];
  private startFunctionName: string;
  private shutdownFunctionName: string;

  constructor(clazz, name?, logger?) {
    super(clazz, name, logger);
    this.startFunctionName = null;
    this.shutdownFunctionName = null;
  }

  getConstructorArgDefinitions(): ParamDefinition[] {
    return this.constructorArgDefinitions;
  }
  getPropertiesToSetDefinitions(): CallDefinition[] {
    return this.propertiesToSetDefinitions;
  }
  getStartFunctionName(): string {
    return this.startFunctionName;
  }
  getShutdownFunctionName(): string {
    return this.shutdownFunctionName;
  }
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

  setPropertyByGroup(paramName, groupName) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withGroupName(groupName)));
    return this;
  }

  setPropertyByDefinitionGroup(paramName, groupName) {
    this.assertState(BaseSingletonState.NOT_STARTED);
    this.propertiesToSetDefinitions.push(new CallDefinition(
      paramName,
      ParamDefinition.withDefinitionGroupName(groupName)));
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

  protected copyInternalProperties(copyTo) {
    super.copyInternalProperties(copyTo);
    copyTo.constructorArgDefinitions = this.constructorArgDefinitions.slice(0);
    copyTo.propertiesToSetDefinitions = this.propertiesToSetDefinitions.slice(0);
    copyTo.startFunctionName = this.startFunctionName;
    copyTo.shutdownFunctionName = this.shutdownFunctionName;
  }

}

export class BaseSingletonDefinition<T> extends ConfigurableSingletonDefinition<T> {
  instancePromise: Promise<T>;

  // private static getMaxStateInstance(def, trace, postLoad: Set<ObjectDefinition<any>>) {
  //   // console.log(`In ${this.getName()} getting max instance of ${def.getName()} - ${def.status} - ${BaseSingletonState.STARTED} / trace: [${trace}]`);
  //   if ((trace.indexOf(def.getName()) >= 0) || (def.status < BaseSingletonState.STARTED)) {
  //     // Circular reference, let's try to go for one that is just instantiated and finalise init afterwards
  //     postLoad.add(def);
  //     // console.log(`Getting ${def.getName()} as Instantiated`);
  //     return def.getInstanceAtState(BaseSingletonState.INSTANTIATED, trace.concat([def.getName()]), postLoad);
  //   }
  //   // console.log(`Getting ${def.getName()} as ready`);
  //   return def.getInstanceWithTrace(trace.concat([def.getName()]), postLoad);
  // }

  constructor(clazz, name?, logger?) {
    super(clazz, name, logger || LogManager.getLogger(__filename));
  }

  // ************************************
  // Get instance methods
  // ************************************

  getInstance(): Promise<T> {
    const self = this;
    if (this.instancePromise) {
      return this.instancePromise;
    }
    try {
      this.checkConstructorCircularDependency();
      // No circular dependencies in the constructor
      this.instancePromise = this.instantiate();
      // At this point our promise will at least instantiate the object.
      const wiredInstancePromise = this.instancePromise
        .then(() => self.setAllProperties())
        .then(() => self.lcStart())
        .then(() => {
          // Once we've set the properties
          self.instancePromise = wiredInstancePromise;
          return self.instance;
        });
      // We should check now if there are circular dependencies on properties
      if (!this.hasPropertiesCircularDependency()) {
        // As we have no Circular Dependencies in setting the properties we can make our dependants wait for our complete initialisation
        this.instancePromise = wiredInstancePromise;
      }
      return this.instancePromise;
    } catch (e) {
      this.instancePromise = Promise.reject(e);
      return this.instancePromise;
    }
  }

  // ************************************
  // Lifecycle methods
  // ************************************

  protected hasPropertiesCircularDependency(trace: Array<string> = []): boolean {
    if (trace.indexOf(this.name) >= 0) {
      trace.push(this.name);
      this.logger.debug(`Circular dependency detected on property injection: ${trace.join(' -> ')}`);
      return true;
    }
    const newTrace = trace.concat([this.name]);
    const toCheck = []
      .concat(this.getAllPropertiesObjectDefinitions())
      .concat(this.getAllConstructorObjectDefinitions());
    return toCheck.some((element) => {
      if (element instanceof BaseSingletonDefinition) {
        if (element.hasPropertiesCircularDependency(newTrace)) {
          return true;
        }
      }
      return false;
    });
  }

  public checkConstructorCircularDependency(trace: Array<string> = []) {
    if (trace.indexOf(this.name) >= 0) {
      trace.push(this.name);
      throw new Error(`Circular dependency detected: ${trace.join(' -> ')}`);
    }
    const newTrace = trace.concat([this.name]);
    this.getAllConstructorObjectDefinitions().forEach((element) => {
      if (element instanceof BaseSingletonDefinition) {
        element.checkConstructorCircularDependency(newTrace);
      }
    });
  }

  protected getAllConstructorObjectDefinitions(): Array<ObjectDefinition<any>> {
    return this.getConstructorArgDefinitions().reduce((prev: ObjectDefinition<any>[], current) => {
      const defs = this.resolveParamObjectDefinition(current);
      if (defs && defs.length > 0) {
        return prev.concat(defs);
      }
      return prev;
    }, []);
  }

  protected getAllPropertiesObjectDefinitions(): Array<ObjectDefinition<any>> {
    return this.getPropertiesToSetDefinitions().reduce((prev: ObjectDefinition<any>[], current) => {
      const allDefs = current.args.reduce((prev2: ObjectDefinition<any>[], currentParamDef) => {
        const defs = this.resolveParamObjectDefinition(currentParamDef);
        if (defs && defs.length > 0) {
          return prev2.concat(defs);
        }
        return prev2;
      }, []);
      if (allDefs && allDefs.length > 0) {
        return prev.concat(allDefs);
      }
      return prev;
    }, []);
  }

  protected getAllPropertyObjectDefinitions(): Array<ObjectDefinition<any>> {
    return this.getPropertiesToSetDefinitions().reduce((prev: ObjectDefinition<any>[], current) => {
      const argu = current.args;
      if (!argu || argu.length <= 0) {
        return prev;
      }
      const defs = [];
      argu.forEach((c) => {
        const od = this.resolveParamObjectDefinition(c);
        if (od) {
          defs.push(od);
        }
      });
      if (defs && defs.length > 0) {
        return prev.concat(defs);
      }
      return prev;
    }, []);
  }

  protected resolveParamObjectDefinition(paramDefinition: ParamDefinition): Array<ObjectDefinition<any>> {
    if (paramDefinition.objectDefinitions) {
      return paramDefinition.objectDefinitions; // It's already resolved. Move on
    }
    switch (paramDefinition.type) {
      case ParamType.Value:
      case ParamType.Config:
        paramDefinition.objectDefinitions = [];
        break;
      case ParamType.Reference:
        paramDefinition.objectDefinitions = [this.context.getDefinitionByName(paramDefinition.refName)];
        break;
      case ParamType.Type:
        paramDefinition.objectDefinitions = [this.context.getDefinitionByType(paramDefinition.className)];
        break;
      case ParamType.TypeArray:
        paramDefinition.objectDefinitions = this.context.getDefinitionsByType(paramDefinition.className);
        break;
      case ParamType.Group:
      case ParamType.DefinitionGroup:
        paramDefinition.objectDefinitions = this.context.getGroupObjectNames(paramDefinition.group).map((refName) => this.context.getDefinitionByName(refName));
        break;
      default:
        throw new IoCException(`Unknown argument type ${paramDefinition.type} on bean ${this.name}`);
    }
    return paramDefinition.objectDefinitions;
  }


  private instantiate(): Promise<T> {
    if (!this.context) {
      return Promise.reject(new IoCException(`ObjectDefinition ${this.getName()} hasn't been added to a context, Can't instantiate`));
    }
    this.setStatus(BaseSingletonState.INSTANTIATING);
    return PromiseUtil.map(this.getConstructorArgDefinitions(), (argDefinition) => this.getParamDefinitionValue(argDefinition))
      .then((constructorArgs) => {
        this.instance = Reflect.construct(this.clazz, constructorArgs);
        this.setStatus(BaseSingletonState.INSTANTIATED);
        return this.instance;
      });
  }

  private setAllProperties(): Promise<void> {
    return PromiseUtil.map(this.getPropertiesToSetDefinitions(), (propertyToSet: CallDefinition) =>
      this.getSetPropertyPromise(propertyToSet)) as any as Promise<void>;
  }

  private getSetPropertyPromise(propertyToSet: CallDefinition): Promise<void> {
    return PromiseUtil.map(propertyToSet.args, (argDefinition) => this.getParamDefinitionValue(argDefinition))
    .then((propertyParams) => {
      this.instance[propertyToSet.paramName] = propertyParams[0]; // TODO: Make use of setters if available.
    });
  }

  getParamDefinitionValue(paramDefinition: ParamDefinition): Promise<any> {
    switch (paramDefinition.type) {
      case ParamType.Value:
        return Promise.resolve(paramDefinition.val);
      case ParamType.Config:
        return Promise.resolve(this.context.getConfig(paramDefinition.key));
      case ParamType.DefinitionGroup:
        return Promise.resolve(paramDefinition.objectDefinitions);
      default:
        const prom = PromiseUtil.map(paramDefinition.objectDefinitions,
        (od) => od.getInstance());
        switch (paramDefinition.type) {
          case ParamType.Reference:
          case ParamType.Type:
            return prom.then((constArgs) => constArgs[0]);
        }
        return prom;
    }
  }

  protected doStart(): Promise<void> {
    if (this.getStartFunctionName()) {
      const resp = this.clazz.prototype[this.getStartFunctionName()].call(this.instance);
      if (resp && resp.then) {
        return resp;
      }
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  protected doStop(): Promise<void> {
    if (this.getShutdownFunctionName()) {
      const resp = this.clazz.prototype[this.getShutdownFunctionName()].call(this.instance);
      if (resp && resp.then) {
        return resp;
      }
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  // protected resolveArgs(constructorArgs): Promise<any[]> {

  //   return PromiseUtil.map(constructorArgs, (arg) => {
  //     switch (arg.type) {
  //       case ParamType.Value:
  //         return arg.val;
  //       case ParamType.Config:
  //         return this.context.getConfig(arg.key);
  //       case ParamType.Reference:
  //         return BaseSingletonDefinition.getMaxStateInstance(
  //           this.context.getDefinitionByName(arg.refName),
  //           trace,
  //           postLoad);
  //       case ParamType.Type:
  //         return BaseSingletonDefinition.getMaxStateInstance(
  //           this.context.getDefinitionByType(arg.className),
  //           trace,
  //           postLoad);
  //       case ParamType.TypeArray:
  //         return Promise.all(
  //           this.context.getDefinitionsByType(arg.className).map(
  //             (d) => BaseSingletonDefinition.getMaxStateInstance(d, trace, postLoad)));
  //       default:
  //         return Promise.reject(new IoCException(`Unknown argument type ${arg.type} on bean ${this.name}`));
  //     }
  //   });
  // }

  public getCopyInstance(): ObjectDefinition<T> {
    return new BaseSingletonDefinition<T>(this.clazz, this.name, this.logger);
  }

}

export class BaseSingletonDefinitionTestUtil extends BaseSingletonDefinition<any> {
  public exposeGetAllConstructorObjectDefinitions(): Array<ObjectDefinition<any>> {
    return this.getAllConstructorObjectDefinitions();
  }
}
