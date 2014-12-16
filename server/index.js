var logger = require('logger')
var config = require('config/config')
var util = require('util')

var start = function() {
	logger.debug('server started');
}

module.exports.start = start;
