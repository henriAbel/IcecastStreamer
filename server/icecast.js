var logger = require('logger');
var config = require('config/config');
var util = require('util');
var net = require('net');
var http = require('http');
var player = require('server/audioPlayer');
var parseString = require('xml2js').parseString;

var Icecast = function() {
	var self = this;
	self.listeners = {};
	this.password = new Buffer('source:' + config.icecast.password).toString('base64');
	var name = config.icecast.name;
	var type = config.icecast.encoder;

	if (type == 'mp3') {
		this.type = 'audio/mpeg';
		var stream = require('audio/mpeg');
		this.streamer = new stream();
	}
	else {
		var errorMsg = 'Encoder not found!! Exiting';
		// Encoder not found
		logger.error(errorMsg);
		console.log(errorMsg);
		process.exit(1);
	}
	this.player = new player(this.streamer);
	this.player.on('songStart', function(song) {
		song.getMetadata(function(data) {
			self.sendMeta(data);
		});
	});
	this.player.on('stop', function() {
		logger.debug('Icecast has been stopped');
		this.connection.close();
	});
	this.connection = self.createConnection();

	if (name.indexOf('/') !== 0) name = '/' + name;
	this.name = name;
};

Icecast.prototype.onMessage = function(message) {
	var msg = message.toString().trim();
	console.log(msg);
	var self = this;
	if (msg == 'HTTP/1.0 200 OK') {
		this.player.connection = this.connection;	
		this.player.start();
		this.intervalId = setInterval(function() {
			self.updateListeners();
		}, 10000);
		this.updateListeners();
	}
};

Icecast.prototype.sendMeta = function(metadata) {
	var songName = metadata.artist !== undefined && metadata.title !== undefined
		? util.format('%s - %s', metadata.artist, metadata.title) 
		: metadata.artist || metadata.title;

	logger.debug(util.format('Send metadata: %s', songName));
	var options = {
		host: config.icecast.host,
		path: encodeURI(util.format('/admin/metadata?pass=%s&mount=%s&mode=updinfo&song=%s', this.password, this.name, songName)),
		port: config.icecast.port,
		headers: {'Authorization': 'Basic ' + this.password}
	};
	http.request(options).end();
};

Icecast.prototype.updateListeners = function() {
	var self = this;
	var options = {
		host: config.icecast.host,
		path: encodeURI(util.format('/admin/listclients?mount=%s', this.name)),
		port: config.icecast.port,
		headers: {'Authorization': 'Basic ' + this.password}
	};
	http.request(options, function(response) {
		response.on('data', function(xml) {
			listeners = parseString(xml.toString(), function (err, result) {
				self.listeners = result;
			});
		});
	}).end();
};

Icecast.prototype.onClose = function() {
	logger.debug('Connection closed');
	console.log('Connection closed');
	if (!this.player.idle) {
		this.player.stop();
		this.connection = this.createConnection();
	}
};

Icecast.prototype.onConnect = function() {
	this.connection.write(util.format('SOURCE %s ICE/1.0\r\ncontent-type: %s\r\nAuthorization: Basic %s\r\n  \
		\r\n ice-description: %s\r\nice-audio-info: ice-samplerate=44100;ice-bitrate=Quality 4;ice-channels=2\r\n\r\n',
		this.name, this.type, this.password, config.icecast.description));
};

Icecast.prototype.createConnection = function() {
	var self = this;
	var client = net.connect({port: config.icecast.port, host: config.icecast.host}, function() {
		self.onConnect();
	});
	client.on('data', function(message) {
		self.onMessage(message);
	});
	client.on('end', function() {
		console.log('connection end');
		self.onClose();
	});
	client.on('error', function(error) {
		console.error(error);
		logger.debug(error);
	});
	return client;
};

module.exports = Icecast;
