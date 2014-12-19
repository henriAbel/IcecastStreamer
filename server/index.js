var logger = require('logger');
var util = require('util');
var Icecast = require('./icecast');


var client, icecast;
var start = function() {
	logger.debug('server started');

	icecast = new Icecast();
}

module.exports.start = start;
