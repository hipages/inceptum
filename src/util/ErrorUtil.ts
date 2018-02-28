
export interface CallSite {
  getThis(): Object,
  /**
   * returns the type of this as a string. This is the name of the function stored in the constructor field of this, if available, otherwise the object's [[Class]] internal property.
   */
  getTypeName(): string,
  /**
   * returns the current function
   */
  getFunction(): Function,
  /**
   * returns the name of the current function, typically its name property. If a name property is not available an attempt will be made to try to infer a name from the function's context.
   */
  getFunctionName(): Function,
  /**
   * return the name of the property of this or one of its prototypes that holds the current function
   */
  getMethodName(): string,
  /**
   * if this function was defined in a script returns the name of the script
   */
  getFileName(): string,
  /**
   * if this function was defined in a script returns the current line number
   */
  getLineNumber(): number,
  /**
   * if this function was defined in a script returns the current column number
   */
  getColumnNumber(): number,
  /**
   * if this function was created using a call to eval returns a CallSite object representing the location where eval was called
   */
  getEvalOrigin(): CallSite,
  /**
   * is this a toplevel invocation, that is, is this the global object?
   */
  isToplevel(): boolean,
  /**
   * does this call take place in code defined by a call to eval?
   */
  isEval(): boolean,
  /**
   * is this call in native V8 code?
   */
  isNative(): boolean,
  /**
   * is this a constructor call?
   */
  isConstructor(): boolean,
}

export class ExtendedError extends Error {
  cause: Error;
  structuredStackTrace: Array<CallSite>;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
  getStructuredStackTrace(): Array<CallSite> {
    if (this.stack.length === 0) {
      return [];
    }
    return this.structuredStackTrace;
  }
  getCause(): Error {
    return this.cause;
  }
}

const original = (Error as any).prepareStackTrace;
if (original) {
  // console.log('Here');
  (global.Error as any).prepareStackTrace = (error, structuredStackTrace) => {
    error.structuredStackTrace = structuredStackTrace;
    return original(error, structuredStackTrace);
  };
}
