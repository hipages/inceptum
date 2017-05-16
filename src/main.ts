import LogManager = require('./log/LogManager')
import { PreinstantiatedSingletonDefinition } from './ioc/objectdefinition/PreinstantiatedSingletonDefinition';

LogManager.setAppName('TestApp');
const myLogger = LogManager.getLogger(__filename);

class MyClass {
  // tslint:disable-next-line:prefer-function-over-method
  myMethod(): boolean {
    return true;
  }
}

const myInstance = new PreinstantiatedSingletonDefinition<MyClass>(new MyClass());
myInstance.getInstance().then((i) => {
  i.
})

myLogger.info('This is a test');