import LogManager = require('./log/LogManager')

LogManager.setAppName('TestApp');
const myLogger = LogManager.getLogger(__filename);

myLogger.info('This is a test');