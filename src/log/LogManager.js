const config = require('config');
const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');
const path = require('path');
const RedisTransport = require('bunyan-redis');
const os = require('os');
const fs = require('fs');
const Transform = require('stream').Transform;
const stringify = require('json-stringify-safe');
const Promise = require('bluebird');

if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
  Promise.longStackTraces();
}
// const RedisStream = require('bunyan-redis-stream');
// const redis = require('redis');

class LevelStringifyTransform extends Transform {
  constructor() {
    super({ writableObjectMode: true, readableObjectMode: true });
  }

  _flush(cb) {
    cb();
  }
  _transform(data, encoding, callback) {
    data.levelStr = data.level ? this.levelSerialiser(data.level) : 'NA';
    callback(null, data);
  }

  levelSerialiser(level) {
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
}

class StringifyTransform extends Transform {
  constructor() {
    super({ writableObjectMode: true, readableObjectMode: false });
  }

  _flush(cb) {
    cb();
  }
  _transform(data, encoding, callback) {
    callback(null, `${stringify(data)}\n`);
  }
}

class LogManager {

  constructor() {
    this.streamCache = new Map();
  }

  getLogger(filePath) {
    if (filePath.substr(0, 1) !== '/') {
      // It's not a full file path.
      return this.getLoggerInternal(filePath);
    }
    return this.getLoggerInternal(this.beSmartOnThePath(filePath));
  }

  setAppName(appName) {
    this.appName = appName;
  }

  beSmartOnThePath(thePath) {
    // Let's see if we can find an ancestor called 'src'
    const srcLoc = thePath.indexOf(`${path.sep}src${path.sep}`);
    if (srcLoc >= 0) {
      return thePath.substr(srcLoc + 5);
    }
    if (thePath.startsWith(process.cwd())) {
      const fromCwd = thePath.substr(process.cwd().length);
      return (fromCwd.startsWith(path.sep)) ? fromCwd.substr(1) : fromCwd;
    }
    return '';
  }

  getLoggerInternal(loggerPath) {
    if (!config.has('Logging.loggers')) {
      throw new Error('Couldn\'t find loggers configuration!!! Your logging config is wrong!');
    }
    const loggers = config.get('Logging.loggers');
    const candidates = loggers.filter((logger) => loggerPath.startsWith(logger.name));
    if (!candidates || candidates.length === 0) {
      candidates.push(loggers.filter((logger) => logger.name === 'ROOT')[0]);
    } else {
      candidates.sort((a, b) => {
        if (a.length > b.length) return -1;
        if (a.length < b.length) return 1;
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
          this.getEffectiveLevel(loggerName, streamName, streamNames[streamName]
          )
        )
    );
    return bunyan.createLogger({ name: loggerPath, streams, serializers: bunyan.stdSerializers, _app: this.appName });
  }

  getEffectiveLevel(loggerName, streamName, configuredLevel) {
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

  getStreamConfig(streamName, level) {
    const configKey = `Logging.streams.${streamName}`;
    if (!config.has(configKey)) {
      throw new Error(`Couldn't find stream with name ${streamName}`);
    }
    const streamConfig = config.get(configKey);
    switch (streamConfig.type) {
      case 'console':
        return {
          stream: this.getUnderlyingStream(streamName),
          level,
          name: streamConfig.name
        };
      case 'file':
        return {
          type: 'raw',
          stream: this.getUnderlyingStream(streamName),
          closeOnExit: true,
          level
        };
      case 'redis':
        return {
          type: 'raw',
          level,
          stream: this.getUnderlyingStream(streamName)
        };
      default:
        throw new Error('Unknown log stream type');
    }
  }

  getUnderlyingStream(streamName) {
    if (!this.streamCache.has(streamName)) {
      const configKey = `Logging.streams.${streamName}`;
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
            levelStringifyTransform.pipe(new StringifyTransform()).pipe(new bunyan.RotatingFileStream({
              path: this.resolvePath(streamConfig.path),
              period: streamConfig.period || '1d',
              count: streamConfig.count || 14
            }));
            this.streamCache.set(streamName, levelStringifyTransform);
          }
          break;
        case 'redis':
          {
            const levelStringifyTransform = new LevelStringifyTransform();
            levelStringifyTransform.pipe(this.getRedisStream(streamConfig));
            this.streamCache.set(streamName, levelStringifyTransform);
          }
          break;
        default:
          throw new Error('Unknown log stream type');
      }
    }
    return this.streamCache.get(streamName);
  }

  resolvePath(thePath) {
    const basePath = process.env.LOG_DIR ||
      (config.has('Logger.dir') && config.get('Logger.dir')) ||
        os.tmpdir();
    const finalPath = path.resolve(basePath, thePath);
    if (!fs.existsSync(path.dirname(finalPath))) {
      this.mkdirpSync(path.dirname(finalPath), 0o766);
    }
    // eslint-disable-next-line no-console
    console.log(`Logging to file: ${finalPath}`);
    return finalPath;
  }

  mkdirpSync(thePath, mode) {
    if (fs.existsSync(thePath)) {
      return true;
    } else if (this.mkdirpSync(path.dirname(thePath), mode)) {
      return fs.mkdirSync(path, mode);
    }
    return false;
  }

  getRedisStream(config) {
    // const redisClient = redis.createClient({
    //   host: process.env.REDIS_HOST || config.host || '127.0.0.1',
    //   port: process.env.REDIS_PORT || config.port || 6379,
    //   db: 0
    // });
    // return new RedisStream({
    //   client: redisClient,
    //   key: config.key || 'phplog',
    //   type: 'list'
    // });
    return new RedisTransport({
      container: config.key || 'phplog',
      host: process.env.REDIS_HOST || config.host || '127.0.0.1',
      port: process.env.REDIS_PORT || config.port || 6379,
      db: 0
    });
  }
}

const SINGLETON = new LogManager();

const baseLogger = SINGLETON.getLogger('ROOT');
process.on('unhandledRejection', (reason, promise) => {
// eslint-disable-next-line no-underscore-dangle
  baseLogger.fatal(`Unhandled promise: ${reason} ${(promise && promise._trace && promise._trace.stack) ? promise._trace.stack : ''}`);
});

process.on('uncaughtException', (err) => {
  baseLogger.fatal({ err }, `Uncaught exception: ${err}`);
});

module.exports = SINGLETON;
