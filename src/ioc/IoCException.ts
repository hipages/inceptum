export class IoCException extends Error {
  context: Object;
  constructor(message: string, context?: Object) {
    super(message);
    this.context = context;
  }
  getContext(): Object {
    return this.context;
  }
}
