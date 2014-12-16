var log = require('log4js');
log.clearAppenders();
log.loadAppender('file');
log.addAppender(log.appenders.file('logs/app.log'), 'App');

var logger = log.getLogger('App');
logger.setLevel('DEBUG');

module.exports = logger;
