// tslint:disable:jsdoc-format
import { setTimeout } from 'timers';

import * as config from 'config';
import * as bunyan from 'bunyan';
import PrettyStream = require('bunyan-prettystream');
import * as path from 'path';
import RotatingFileStream = require('bunyan-rotating-file-stream');
import * as os from 'os';
import * as fs from 'fs';
import * as stream from 'stream';
import stringify = require('json-stringify-safe');
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { ExtendedError } from '../util/ErrorUtil';

export abstract class Logger {
  /**
     * Returns a boolean: is the `trace` level enabled?
     * This is equivalent to `log.isTraceEnabled()` or `log.isEnabledFor(TRACE)` in log4j.
     */
  abstract trace(): boolean;
  /**
     * The first field can optionally be a "fields" object, which
     * is merged into the log record.
     * Special case to log an `Error` instance to the record.
     * This adds an `err` field with exception details
     * (including the stack) and sets `msg` to the exception
     * message or you can specify the `msg`.
     */
  abstract trace(error: Error | Buffer | Object, format?: any, ...params: any[]): void;

  /**
     * Uses `util.format` for msg formatting.
     */
  abstract trace(format: string | number, ...params: any[]): void;

  /**
  * Returns a boolean: is the `debug` level enabled?
  * This is equivalent to `log.isDebugEnabled()` or `log.isEnabledFor(DEBUG)` in log4j.
  */
  abstract debug(): boolean;

  /**
     * Special case to log an `Error` instance to the record.
     * This adds an `err` field with exception details
     * (including the stack) and sets `msg` to the exception
     * message or you can specify the `msg`.
     */
  abstract debug(error: Error | Buffer | Object, format?: any, ...params: any[]): void;
  /**
     * Uses `util.format` for msg formatting.
     */
  abstract debug(format: string | number, ...params: any[]): void;

  /**
     * Returns a boolean: is the `info` level enabled?
     * This is equivalent to `log.isInfoEnabled()` or `log.isEnabledFor(INFO)` in log4j.
     */
  abstract info(): boolean;

  /**
     * Special case to log an `Error` instance to the record.
     * This adds an `err` field with exception details
     * (including the stack) and sets `msg` to the exception
     * message or you can specify the `msg`.
     */
  abstract info(error: Error | Buffer | Object, format?: any, ...params: any[]): void;

  /**
     * Uses `util.format` for msg formatting.
     */
  abstract info(format: string | number, ...params: any[]): void;

  /**
     * Returns a boolean: is the `warn` level enabled?
     * This is equivalent to `log.isWarnEnabled()` or `log.isEnabledFor(WARN)` in log4j.
     */
  abstract warn(): boolean;

  /**
     * Special case to log an `Error` instance to the record.
     * This adds an `err` field with exception details
     * (including the stack) and sets `msg` to the exception
     * message or you can specify the `msg`.
     */
  abstract warn(error: Error | Buffer | Object, format?: any, ...params: any[]): void;

  /**
     * Uses `util.format` for msg formatting.
     */
  abstract warn(format: string | number, ...params: any[]): void;

  /**
     * Returns a boolean: is the `error` level enabled?
     * This is equivalent to `log.isErrorEnabled()` or `log.isEnabledFor(ERROR)` in log4j.
     */
  abstract error(): boolean;

  /**
     * Special case to log an `Error` instance to the record.
     * This adds an `err` field with exception details
     * (including the stack) and sets `msg` to the exception
     * message or you can specify the `msg`.
     */
  abstract error(error: Error | Buffer | Object, format?: any, ...params: any[]): void;

  /**
     * Uses `util.format` for msg formatting.
     */
  abstract error(format: string | number, ...params: any[]): void;

  /**
     * Returns a boolean: is the `fatal` level enabled?
     * This is equivalent to `log.isFatalEnabled()` or `log.isEnabledFor(FATAL)` in log4j.
     */
  abstract fatal(): boolean;

  /**
     * Special case to log an `Error` instance to the record.
     * This adds an `err` field with exception details
     * (including the stack) and sets `msg` to the exception
     * message or you can specify the `msg`.
     */
  abstract fatal(error: Error | Buffer | Object, format?: any, ...params: any[]): void;

  /**
     * Uses `util.format` for msg formatting.
     */
  abstract fatal(format: string | number, ...params: any[]): void;
}

class LevelStringifyTransform extends stream.Transform {
  private static levelSerialiser(level) {
    switch (level) {
      case bunyan.TRACE:
        return 'TRACE';
      case bunyan.DEBUG:
        return 'DEBUG';
      case bunyan.INFO:
        return 'INFO';
      case bunyan.WARN:
        return 'WARN';
      case bunyan.ERROR:
        return 'ERROR';
      case bunyan.FATAL:
        return 'FATAL';
      default:
        return 'N/A';
    }
  }

  constructor() {
    super({ writableObjectMode: true, readableObjectMode: true });
  }
  // tslint:disable-next-line:prefer-function-over-method
  _flush(cb) {
    cb();
  }
  // tslint:disable-next-line:prefer-function-over-method
  _transform(data, encoding, callback) {
    data.levelStr = data.level ? LevelStringifyTransform.levelSerialiser(data.level) : 'NA';
    callback(null, data);
  }
}

class CloseableLevelStringifyTransform extends LevelStringifyTransform {
}

class StringifyTransform extends stream.Transform {
  constructor() {
    super({ writableObjectMode: true, readableObjectMode: false });
  }
  // tslint:disable-next-line:prefer-function-over-method
  _flush(cb) {
    cb();
  }
  // tslint:disable-next-line:prefer-function-over-method
  _transform(data, encoding, callback) {
    callback(null, `${stringify(data)}\n`);
  }
}

class ConsoleRawStream extends stream.Writable {
  constructor() {
    super({objectMode: true});
  }
  _write(rec: any, encoding: string, cb: Function): boolean {
    if (rec.level < bunyan.WARN) {
      return process.stdout.write(`${stringify(rec)}\n`, encoding, cb);
    }
    return process.stderr.write(`${stringify(rec)}\n`, encoding, cb);
  }
}

export class LogManagerInternal {
  static setAppName;
  static getLogger;

  private static beSmartOnThePath(thePath: string): string {
    // Let's see if we can find an ancestor called 'src'
    const srcLoc = thePath.indexOf(`${path.sep}src${path.sep}`);
    if (srcLoc >= 0) {
      return thePath.substr(srcLoc + 5);
    }
    const builtLoc = thePath.indexOf(`${path.sep}dist${path.sep}`);
    if (builtLoc >= 0) {
      return thePath.substr(builtLoc + 6);
    }
    if (thePath.startsWith(process.cwd())) {
      const fromCwd = thePath.substr(process.cwd().length);
      return fromCwd.startsWith(path.sep) ? fromCwd.substr(1) : fromCwd;
    }
    return thePath;
  }
  private static getEffectiveLevel(loggerName: string, streamName: string, configuredLevel: string): bunyan.LogLevel {
    let overrideEnv = `LOG_${loggerName}_${streamName}`.replace('/[^a-zA-z0-9_]+/', '_').replace('/[_]{2,}', '_').toUpperCase();
    if (process.env[overrideEnv]) {
      return process.env[overrideEnv] as bunyan.LogLevel;
    }
    overrideEnv = `LOG_${loggerName}`.replace('/[^a-zA-z0-9_]+/', '_').replace('/[_]{2,}', '_').toUpperCase();
    if (process.env[overrideEnv]) {
      return process.env[overrideEnv] as bunyan.LogLevel;
    }
    return configuredLevel as bunyan.LogLevel;
  }

  private static mkdirpSync(thePath: string, mode: number): boolean {
    if (fs.existsSync(thePath)) {
      return true;
    } else if (this.mkdirpSync(path.dirname(thePath), mode)) {
      fs.mkdirSync(path.basename(thePath), mode);
      return true;
    }
    return false;
  }

  private static resolvePath(thePath: string): string {
    const basePath = process.env.LOG_DIR || (config.has('Logger.dir') && config.get('Logger.dir')) || os.tmpdir();
    const finalPath = path.resolve(basePath, thePath);
    if (!fs.existsSync(path.dirname(finalPath))) {
      LogManagerInternal.mkdirpSync(path.dirname(finalPath), 0o766);
    }
    // eslint-disable-next-line no-console
    // tslint:disable-next-line:no-console
    console.log(`Logging to file: ${finalPath}`);
    return finalPath;
  }

  private streamCache: Map<string, bunyan.Stream | LevelStringifyTransform> = new Map();
  private appName: string = config.get('app.name', 'na');

  getLogger(filePath?: string): Logger {
    // console.log(`Got here with filePath: ${filePath}`);
    const thePath = removeExtension(filePath || _getCallerFile());
    if (thePath.substr(0, 1) !== '/') {
      // It's not a full file path.
      return this.getLoggerInternal(thePath);
    }
    return this.getLoggerInternal(LogManagerInternal.beSmartOnThePath(thePath));
  }

  scheduleShutdown() {
    setTimeout(() => this.closeStreams(), 1000);
  }

  closeStreams() {
    this.streamCache.forEach((streamToClose) => {
      if (streamToClose instanceof CloseableLevelStringifyTransform) {
        streamToClose.end();
      }});
  }

  setAppName(appName: string): void {
    this.appName = appName;
  }

  getAppName(): string {
    return this.appName;
  }

  getLoggerInternal(loggerPath: string): Logger {
    if (!config.has('logging.loggers')) {
      throw new Error("Couldn't find loggers configuration!!! Your logging config is wrong!");
    }
    const loggers = config.get('logging.loggers');
    const candidates = loggers.filter((logger) => loggerPath.startsWith(logger.name));
    if (!candidates || candidates.length === 0) {
      candidates.push(loggers.filter((logger) => logger.name === 'ROOT')[0]);
    } else {
      candidates.sort((a, b) => {
        if (a.length > b.length) {
          return -1;
        }
        if (a.length < b.length) {
          return 1;
        }
        return 0;
      });
    }
    const loggerConfig = candidates[0];
    const loggerName = loggerConfig.name;
    const streamNames = loggerConfig.streams;
    const streams = Object.keys(streamNames)
    .filter((streamName) => {
      const level = LogManagerInternal.getEffectiveLevel(loggerName, streamName, streamNames[streamName]) as string;
      return level && level.toUpperCase() !== 'OFF';
    })
    .map((streamName) =>
      this.getStreamConfig(
        streamName,
        LogManagerInternal.getEffectiveLevel(loggerName, streamName, streamNames[streamName]),
      ),
    );
    return bunyan.createLogger({ name: loggerPath, streams, serializers: bunyan.stdSerializers, appName: this.appName ? this.appName.toLowerCase() : 'appNameNotAvailable' });
  }

  getStreamConfig(streamName: string, level: bunyan.LogLevel) {
    const configKey = `logging.streams.${streamName}`;
    if (!config.has(configKey)) {
      throw new Error(`Couldn't find stream with name ${streamName}`);
    }
    const streamConfig = config.get(configKey);
    switch (streamConfig.type) {
      case 'console':
        return {
          stream: this.getUnderlyingStream(streamName),
          level,
          name: streamConfig.name,
        };
      case 'json':
          return {
              type: 'raw',
              stream: this.getUnderlyingStream(streamName),
              closeOnExit: false,
              level,
          };
      case 'file':
        return {
          type: 'raw',
          stream: this.getUnderlyingStream(streamName),
          closeOnExit: true,
          level,
        };
      default:
        throw new Error('Unknown log stream type');
    }
  }

  getUnderlyingStream(streamName: string): bunyan.Stream {
    if (!this.streamCache.has(streamName)) {
      const configKey = `logging.streams.${streamName}`;
      if (!config.has(configKey)) {
        throw new Error(`Couldn't find stream with name ${streamName}`);
      }
      const streamConfig = config.get(configKey);
      switch (streamConfig.type) {
        case 'console':
          {
            const prettyStream = new PrettyStream();
            prettyStream.pipe(process.stdout);
            this.streamCache.set(streamName, prettyStream);
          }
          break;
        case 'json':
          {
            const levelStringifyTransform = new LevelStringifyTransform();
            levelStringifyTransform.pipe(new ConsoleRawStream());
            this.streamCache.set(streamName, levelStringifyTransform);
          }
          break;
        case 'file':
          {

          }
          break;
        default:
          throw new Error('Unknown log stream type');
      }
    }
    return this.streamCache.get(streamName) as bunyan.Stream;
  }
}

export const LogManager = new LogManagerInternal();

const baseLogger = LogManager.getLogger('ROOT');
process.on('unhandledRejection', (reason, promise) => {
  if (NewrelicUtil.isNewrelicAvailable()) {
    NewrelicUtil.getNewrelicIfAvailable().noticeError(reason, {source: 'unhandledRejection'});
  }
  // eslint-disable-next-line no-underscore-dangle
  baseLogger.fatal(reason,
    `Unhandled promise: ${reason}`,
  );
});

process.on('uncaughtException', (err) => {
  if (NewrelicUtil.isNewrelicAvailable()) {
    NewrelicUtil.getNewrelicIfAvailable().noticeError(err, {source: 'unhandledException'});
  }
  baseLogger.fatal(err, `Uncaught exception: ${err} | ${err.stack}`);
});

process.on('warning', (err) => {
  baseLogger.warn(err , `Uncaught warning: ${err} | ${err.stack}`);
});

function _getCallerFile() {
  let callerFile;
  const err = new ExtendedError('Getting Stack');
  const structuredStackTrace = err.getStructuredStackTrace();
  if (structuredStackTrace) {
    // console.log(structuredStackTrace.map((cs) => cs.getFileName()));
    const currentFile = structuredStackTrace.shift().getFileName();
    callerFile = currentFile;
    while (structuredStackTrace.length && currentFile === callerFile) {
      callerFile = structuredStackTrace.shift().getFileName();
    }
    if (!callerFile) {
      return '/na';
    }
    return callerFile;
  }
  return '/na';
}

function removeExtension(thePath: string) {
  if (['.js', '.ts'].indexOf(thePath.substr(-3)) >= 0) {
    return thePath.substring(0, thePath.length - 3);
  }
  return thePath;
}
