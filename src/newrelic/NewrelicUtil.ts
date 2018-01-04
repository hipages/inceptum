
let NEWRELIC_AVAILABLE = false;
let NEWRELIC = null;
try {
  if (require.resolve('newrelic')) {
    NEWRELIC_AVAILABLE = true;
    // tslint:disable-next-line:no-var-requires
    NEWRELIC = require('newrelic');
  }
// tslint:disable-next-line:no-empty
} catch (e) {
}

export abstract class NewRelic {
  abstract noticeError(error: Error | Object, customParams?: object);
  abstract shutdown(opts: object, cb: (e) => void);
  abstract setTransactionName(name: string);
  abstract startBackgroundTransaction(name: string, group?: string, handle?: () => any);
  abstract getTransaction();
}

export class NewrelicUtil {
  static isNewrelicAvailable() {
    return NEWRELIC_AVAILABLE;
  }
  static getNewrelicIfAvailable(): NewRelic {
    if (NEWRELIC_AVAILABLE) {
      return NEWRELIC;
    } else {
      return undefined;
    }
  }

  static mockUtil_setNewrelic(newrelic) {
    if (newrelic) {
      NEWRELIC_AVAILABLE = true;
      NEWRELIC = newrelic;
    } else {
      NEWRELIC_AVAILABLE = false;
      NEWRELIC = null;
    }
  }

  static noticeError(e: Error, params?: object) {
    const nr: NewRelic = NewrelicUtil.getNewrelicIfAvailable();
    if (nr) {
      nr.noticeError(e, params);
    }
  }

}
