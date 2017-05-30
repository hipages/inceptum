import LogManager from './log/LogManager';
import { PreinstantiatedSingletonDefinition } from './ioc/objectdefinition/PreinstantiatedSingletonDefinition';

LogManager.setAppName('TestApp');
const myLogger = LogManager.getLogger();

class MyClass {
  // tslint:disable-next-line:prefer-function-over-method
  myMethod(): boolean {
    return true;
  }
}

const myInstance = new PreinstantiatedSingletonDefinition<MyClass>(new MyClass());


myLogger.info('This is a test');