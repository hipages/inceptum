const { Context } = require('../ioc/Context');
const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');
const path = require('path');
const RedisTransport = require('bunyan-redis');
const os = require('os');
const fs = require('fs');
const Transform = require('stream').Transform;
const stringify = require('json-stringify-safe');
// const RedisStream = require('bunyan-redis-stream');
// const redis = require('redis');

class LevelFixingTransform extends Transform {
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
    if (!Context.hasConfig('Logging.loggers')) {
      throw new Error('Couldn\'t find loggers configuration!!! Your logging config is wrong!');
    }
    const loggers = Context.getConfig('Logging.loggers');
    const candidates = Object.keys(loggers).filter((logger) => loggerPath.startsWith(logger.name));
    if (!candidates || candidates.length === 0) {
      candidates.push('ROOT');
    } else {
      candidates.sort((a, b) => {
        if (a.length > b.length) return -1;
        if (a.length < b.length) return 1;
        return 0;
      });
    }
    const loggerName = candidates[0];
    const loggerConfig = loggers.find((t) => (t.name === loggerName));
    const streamNames = loggerConfig.streams;
    const streams = Object.keys(streamNames).map((streamName) => this.getStreamConfig(streamName, streamNames[streamName]));
    return bunyan.createLogger({ name: loggerPath, streams, _app: this.appName });
  }


  getStreamConfig(streamName, level) {
    const prettyStream = new PrettyStream();
    const configKey = `Logging.streams.${streamName}`;
    if (!Context.hasConfig(configKey)) {
      throw new Error(`Couldn't find stream with name ${streamName}`);
    }
    const transformStream = new LevelFixingTransform();
    const streamConfig = Context.getConfig(configKey);
    switch (streamConfig.type) {
      case 'console':
        prettyStream.pipe(process.stdout);
        return {
          stream: prettyStream,
          level,
          name: streamConfig.name
        };
      case 'file':
        transformStream.pipe(new StringifyTransform()).pipe(new bunyan.RotatingFileStream({
          path: this.resolvePath(streamConfig.path),
          period: streamConfig.period || '1d',
          count: streamConfig.count || 14
        }));
        return {
          type: 'raw',
          stream: transformStream,
          closeOnExit: true,
          level
        };
      case 'redis':
        transformStream.pipe(this.getRedisStream(streamConfig));
        return {
          type: 'raw',
          level,
          stream: transformStream
        };
      default:
        throw new Error('Unknown log stream type');
    }
  }


  resolvePath(thePath) {
    const basePath = process.env.LOG_DIR ||
      (Context.hasConfig('Logger.dir') && Context.getConfig('Logger.dir')) ||
        os.tmpdir();
    const finalPath = path.resolve(basePath, thePath);
    if (!fs.existsSync(path.dirname(finalPath))) {
      this.mkdirpSync(path.dirname(finalPath), 0o766);
    }
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

module.exports = SINGLETON;
