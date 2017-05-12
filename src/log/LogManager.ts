import * as config from 'config';
import * as bunyan from 'bunyan';
import PrettyStream = require('bunyan-prettystream');
import * as path from 'path';
import RotatingFileStream = require('bunyan-rotating-file-stream');
import RedisTransport = require('bunyan-redis');
import * as os from 'os';
import * as fs from 'fs';
import * as stream from 'stream';
import stringify = require('json-stringify-safe');

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

class LogManager {
  private static beSmartOnThePath(thePath: string): string {
    // Let's see if we can find an ancestor called 'src'
    const srcLoc = thePath.indexOf(`${path.sep}src${path.sep}`);
    if (srcLoc >= 0) {
      return thePath.substr(srcLoc + 5);
    }
    const builtLoc = thePath.indexOf(`${path.sep}built${path.sep}`);
    if (builtLoc >= 0) {
      return thePath.substr(builtLoc + 7);
    }
    if (thePath.startsWith(process.cwd())) {
      const fromCwd = thePath.substr(process.cwd().length);
      return (fromCwd.startsWith(path.sep)) ? fromCwd.substr(1) : fromCwd;
    }
    return '';
  }
  private static getEffectiveLevel(loggerName: string, streamName: string, configuredLevel: string): string {
    let overrideEnv = `LOG_${loggerName}_${streamName}`
      .replace('/[^a-zA-z0-9_]+/', '_')
      .replace('/[_]{2,}', '_');
    if (process.env[overrideEnv]) {
      return process.env[overrideEnv];
    }
    overrideEnv = `LOG_${loggerName}`
      .replace('/[^a-zA-z0-9_]+/', '_')
      .replace('/[_]{2,}', '_');
    if (process.env[overrideEnv]) {
      return process.env[overrideEnv];
    }
    return configuredLevel;
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

  private static getRedisStream(config: {key: string, host: string, port: number}): RedisTransport {
    return new RedisTransport({
      container: config.key || 'phplog',
      host: process.env.REDIS_HOST || config.host || '127.0.0.1',
      port: process.env.REDIS_PORT || config.port || 6379,
      db: 0,
    });
  }

  private static resolvePath(thePath: string): string {
    const basePath = process.env.LOG_DIR ||
      (config.has('Logger.dir') && config.get('Logger.dir')) ||
        os.tmpdir();
    const finalPath = path.resolve(basePath, thePath);
    if (!fs.existsSync(path.dirname(finalPath))) {
      LogManager.mkdirpSync(path.dirname(finalPath), 0o766);
    }
    // eslint-disable-next-line no-console
    // tslint:disable-next-line:no-console
    console.log(`Logging to file: ${finalPath}`);
    return finalPath;
  }

  private streamCache: Map<string, bunyan.Stream> = new Map();
  private appName: string;

  getLogger(filePath) {
    if (filePath.substr(0, 1) !== '/') {
      // It's not a full file path.
      return this.getLoggerInternal(filePath);
    }
    return this.getLoggerInternal(LogManager.beSmartOnThePath(filePath));
  }

  setAppName(appName: string): void {
    this.appName = appName;
  }

  getAppName(): string {
    return this.appName;
  }

  getLoggerInternal(loggerPath: string) {
    if (!config.has('logging.loggers')) {
      throw new Error('Couldn\'t find loggers configuration!!! Your logging config is wrong!');
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
    const streams = Object.keys(streamNames).map(
      (streamName) =>
        this.getStreamConfig(
          streamName,
          LogManager.getEffectiveLevel(loggerName, streamName, streamNames[streamName],
          ),
        ),
    );
    return bunyan.createLogger({ name: loggerPath, streams, serializers: bunyan.stdSerializers, _app: this.appName });
  }

  getStreamConfig(streamName: string, level: string) {
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
      case 'file':
        return {
          type: 'raw',
          stream: this.getUnderlyingStream(streamName),
          closeOnExit: true,
          level,
        };
      case 'redis':
        return {
          type: 'raw',
          level,
          stream: this.getUnderlyingStream(streamName),
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
        case 'file':
          {
            const levelStringifyTransform = new LevelStringifyTransform();
            levelStringifyTransform.pipe(new StringifyTransform()).pipe(new RotatingFileStream({
              path: LogManager.resolvePath(streamConfig.path),
              period: streamConfig.period || '1d',
              count: streamConfig.count || 14,
            }));
            this.streamCache.set(streamName, levelStringifyTransform);
          }
          break;
        case 'redis':
          {
            const levelStringifyTransform = new LevelStringifyTransform();
            levelStringifyTransform.pipe(LogManager.getRedisStream(streamConfig));
            this.streamCache.set(streamName, levelStringifyTransform);
          }
          break;
        default:
          throw new Error('Unknown log stream type');
      }
    }
    return this.streamCache.get(streamName);
  }
}

const SINGLETON = new LogManager();

const baseLogger = SINGLETON.getLogger('ROOT');
process.on('unhandledRejection', (reason, promise) => {
// eslint-disable-next-line no-underscore-dangle
  baseLogger.fatal(`Unhandled promise: ${reason} ${(promise && promise._trace && promise._trace.stack) ? promise._trace.stack : ''}`);
});

process.on('uncaughtException', (err) => {
  baseLogger.fatal({ err }, `Uncaught exception: ${err} | ${err.stack}`);
});

export = SINGLETON;
