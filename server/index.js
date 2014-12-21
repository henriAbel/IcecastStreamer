var logger = require('logger');
var util = require('util');
var Icecast = require('./icecast');


var icecast;
var start = function() {
	icecast = new Icecast();
}

var getInstance = function() {
	return icecast;
}

module.exports.start = start;
module.exports.getInstance = getInstance;
