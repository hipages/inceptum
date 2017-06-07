import { Context } from '../Context';
import { Logger, LogManager } from '../../log/LogManager';
import { Lifecycle, LifecycleState } from './../Lifecycle';

export abstract class ObjectDefinition<T> extends Lifecycle {
  context: Context;
  autowireCandidate: boolean;
  instance: T;
  lazyLoading: boolean;
  clazz: Function;

  constructor(clazz: Function, name: string, logger: Logger) {
    super(name || clazz.name, logger || LogManager.getLogger());
    this.clazz = clazz;
    this.lazyLoading = true;
    this.instance = null;
    this.autowireCandidate = true;
    this.context = null;
  }

  // ************************************
  // Configuration methods
  // ************************************

  withLazyLoading(lazyLoading: boolean): ObjectDefinition<T> {
    this.assertState(LifecycleState.NOT_STARTED);
    this.lazyLoading = lazyLoading;
    return this;
  }
  setAutowireCandidate(autowireCandidate: boolean): ObjectDefinition<T> {
    this.assertState(LifecycleState.NOT_STARTED);
    this.autowireCandidate = autowireCandidate;
    return this;
  }
  setContext(context: Context) {
    this.assertState(LifecycleState.NOT_STARTED);
    this.context = context;
  }
  getContext(): Context {
    return this.context;
  }

  // ************************************
  // Get instance methods
  // ************************************

  abstract getInstance(): Promise<T>;

  // ************************************
  // Information methods
  // ************************************

  getProducedClass(): any { // TODO figure out how to to static interfaces for startMethod, stopMethod
    return this.clazz;
  }

  isLazy(): boolean {
    return this.lazyLoading;
  }

  isAutowireCandidate(): boolean {
    return this.autowireCandidate;
  }

  copy(): ObjectDefinition<T> {
    const theCopy = this.getCopyInstance();
    this.copyInternalProperties(theCopy);
    return theCopy;
  }

  protected copyInternalProperties(copyTo): void {
    copyTo.lazyLoading = this.lazyLoading;
    copyTo.autowireCandidate = this.autowireCandidate;
    copyTo.context = null;  // The copy must not inherit the context
  }

  protected abstract getCopyInstance(): ObjectDefinition<T>;
}
