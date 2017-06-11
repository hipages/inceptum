import { Context } from 'typedoc/dist/lib/converter';

export class MockObj {
  objProto: Object;
  constructor(objProto: Object) {
    this.objProto = objProto;
  }
}

export class MyProxyHandler<T extends Object> implements ProxyHandler<T> {
  expects: any[];
  baseClass: Function;
  constructor(baseClass: Function) {
    this.baseClass = baseClass;
    this.expects = [];
  }
  get(target: T, p: PropertyKey, receiver: any): any {
    // console.log('Call to get with: ', target, p);
    if (p === '__getTarget') {
      return target;
    }
    if (p === '__getProxyHandler') {
      return this;
    }
    if (this.baseClass.prototype[p] && this.baseClass.prototype[p] instanceof Function) {
      const func = (...args) => {
        return this.doCall(target, p, args);
      };
      func['__name'] = p;
      func['__handler'] = this;
      return func;
    }
    return target[p];
  }
  registerExpect(funcName: string, args: Array<any>, resp: any) {
    // console.log('Registering: ', funcName, args, resp);
    this.expects.push({ funcName, args, resp });
  }
  doCall(target: T, p: PropertyKey, args: Array<any>): any {
    // console.log('Doing actual call with', target, p, args);
    const realArgs = (args === undefined) ? [] : args;
    const expect = this.expects.find((e) => {
      return (e.funcName === p) && arrEqual(e.args, args);
    });
    if (expect) {
      // console.log('Got expect', expect);
      return expect.resp;
    }
    throw new Error(`Unexpected mock call of method ${p} with args: ${args}`);
  }
}

export function mock<H extends Object>(clazz: Function, target?: H): H {
  return new Proxy<H>(target ? target : {} as H, new MyProxyHandler<H>(clazz));
}

export class ResponseCapture {
  args: any[];
  functionName: string;
  handler: MyProxyHandler<any>;
  constructor(handler: MyProxyHandler<any>, functionName: string, args: Array<any>) {
    this.handler = handler;
    this.functionName = functionName;
    this.args = args;
  }
  thenReturn(resp: any) {
    this.handler.registerExpect(this.functionName, this.args, resp);
  }
}

export class CallCapture {
  functionName: string;
  args: any[];
  handler: MyProxyHandler<any>;
  constructor(handler: MyProxyHandler<any>, functionName: string) {
    this.handler = handler;
    this.functionName = functionName;
  }
  isCalled(): ResponseCapture {
    this.args = [];
    return new ResponseCapture(this.handler, this.functionName, []);
  }
  isCalledWith(...args): ResponseCapture {
    this.args = args;
    return new ResponseCapture(this.handler, this.functionName, args);
  }
}

export function when(f: Function): CallCapture {
  if (f && f['__handler']) {
    return new CallCapture(f['__handler'], f['__name']);
  }
  throw new Error('Can only when on mock objects');
}

function arrEqual(arr1: Array<any>, arr2: Array<any>): boolean {
  if (arr1 === arr2) {
    return true;
  }
  if (arr1.length !== arr2.length) {
    return false;
  }
  if ((arr1 === undefined) || (arr2 === undefined)) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
      // Check if we have nested arrays
      if (arr1[i] instanceof Array && arr2[i] instanceof Array) {
        // recurse into the nested arrays
        if (!arrEqual(arr1[i], arr2[i])) {
          return false;
        }
      } else if (arr1[i] !== arr2[i]) {
        // Warning - two different object instances will never be equal: {x:20} != {x:20}
        return false;
      }
  }
  return true;
}
