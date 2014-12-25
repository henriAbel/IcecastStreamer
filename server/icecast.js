var logger = require('logger');
var config = require('config/config');
var util = require('util');
var net = require('net');
var http = require('http');
var player = require('server/audioPlayer');

var Icecast = function() {
	var self = this;
	var client = net.connect({port: config.icecast.port, host: config.icecast.host}, function() {
		self.onConnect();
	});
	client.on('data', function(message) {
		self.onMessage(message);
	});
	client.on('end', this.onClose);
	this.connection = client;
	this.password = new Buffer('source:' + config.icecast.password).toString('base64');
	var name = config.icecast.name;
	var type = config.icecast.encoder;

	if (type == 'mp3') {
		this.type = 'audio/mpeg';
		var stream = require('audio/mpeg');
		this.streamer = new stream(this.connection);
	}
	else {
		// Encoder not found
		process.exit(1);
	}

	if (name.indexOf('/') != 0) name = '/' + name;
	this.name = name;

}

Icecast.prototype.onMessage = function(message) {
	var msg = message.toString().trim();
	var self = this;
	if (msg == 'HTTP/1.0 200 OK') {
		this.player = new player(this.streamer);
		this.player.on('songChange', function(song) {
			song.getMetadata(function(data) {
				self.sendMeta(data);
			})
		});
		this.player.start();
	}
}

Icecast.prototype.sendMeta = function(metadata) {
	var songName = util.format('%s - %s', metadata.artist, metadata.title);
	logger.debug(util.format('Send metadata: %s', songName));
	var options = {
		host: config.icecast.host,
		path: encodeURI(util.format('/admin/metadata?pass=%s&mount=%s&mode=updinfo&song=%s', this.password, this.name, songName)),
		port: config.icecast.port,
		headers: {'Authorization': 'Basic ' + this.password}
	};
	http.request(options).end();
}

Icecast.prototype.onClose = function() {
	logger.debug('Connection closed');
}

Icecast.prototype.onConnect = function() {
	this.connection.write(util.format('SOURCE %s ICE/1.0\r\ncontent-type: %s\r\nAuthorization: Basic %s\r\n  \
		\r\n ice-description: %s\r\nice-audio-info: ice-samplerate=44100;ice-bitrate=Quality 4;ice-channels=2\r\n\r\n',
		this.name, this.type, this.password, config.icecast.description));
};

module.exports = Icecast;
