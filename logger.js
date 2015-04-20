var log = require('log4js');
var config = require('config/config');

log.clearAppenders();
log.loadAppender('file');
log.addAppender(log.appenders.file('logs/app.log'), 'App');

var logger = log.getLogger('App');
logger.setLevel(config.debugLevel || 'INFO');

module.exports = logger;
