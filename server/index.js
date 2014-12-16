var logger = require('logger');
var config = require('config/config');
var util = require('util');
var net = require('net');

var client;
var start = function() {
	logger.debug('server started');
	client = net.connect({port: config.icecast.port, host: config.icecast.host}, function() {
		onConnect();
	});
	client.on('data', onMessage);
	client.on('end', onClose);
}

var onConnect = function() {
	logger.debug('connected to icecast');
	client.write('SOURCE /stream ICE/1.0\r\ncontent-type: audio/mpeg\r\nAuthorization: Basic c291cmNlOmhhY2ttZQ==\r\n ice-bitrate: Quality 0\r\nice-description: This is my server description\r\nice-audio-info: ice-samplerate=44100;ice-bitrate=Quality 5;ice-channels=2\r\n');
}

var onMessage = function(message) {
	logger.debug(message);
}

var onClose = function() {
	logger.debug('Connection closed');
}

module.exports.start = start;
