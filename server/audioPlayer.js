var logger = require('logger');
var config = require('config/config');
var util = require('util');
var events = require('events');
var metadata = require('ffmetadata');
var audioFile = require('./audioFile');
var playlistManager = require('./playlist');

// in ms
var streamBuffer = 1000;

var Player = function(streamer) {
	this.streamer = streamer;
	this.connection = undefined;
	this.idle = true;
	events.EventEmitter.call(this);
	var self = this;
	self.playlistManager = new playlistManager();
	self.playlistManager.on('stop', function() {
		logger.debug('Audioplayer has been stopped');
		self.stop();
		this.emit('stop');
	});
	this.currentSong;
	this.on('songStart', function() {
		self.currentSong = self.nextSongModel;
		self.emit('songChange', self.currentSong);
		var stream = self.nextSong();
		getDataFromStream(stream, function(nextSongCrossfaded) {
			// Fastest way to clone buffer
			var originalDataBuffer = new Buffer(nextSongCrossfaded.length);
			nextSongCrossfaded.copy(originalDataBuffer);
			// Just set variable. If next is called before songEnd event, this data is used 
			self.nextSongData = originalDataBuffer;
			// Crossfade current track with next one
			crossfade(nextSongCrossfaded, self.currentSongData, config.crossfade);
			self.nextSongCrossfaded = nextSongCrossfaded;
			
		});
	})
	
	this.on('songEnd', function() {
		self.nextSongData = self.nextSongCrossfaded;
		self.next();
	});
}

Player.prototype.__proto__ = events.EventEmitter.prototype;

Player.prototype.start = function() {
	var self = this;
	var stream = self.nextSong();
	this.idle = false;
	getDataFromStream(stream, function(data) {
		self.nextSongData = data;

		this.start = Date.now();
		self.next();
		this.interval = setInterval(function() {
			self.sendData();
		}, 900);
	});
};

/*
16 bit pcm
44100 sampling rate
2 channels
*/
var crossfade = function(pcm1, pcm2, seconds) {
	if (seconds < 1) return;
	var bytes = seconds * 44100 * 16 / 8 * 2;
	var pcm2Offset = pcm2.length - bytes;
	var pcm1Volume = 0;
	var pcm2Volume = 1;
	var levels = Math.round(bytes / 20);
	for (var i = 0; i < bytes / 2; i++) {
		if (i % levels == 0) {
			pcm1Volume = i / (bytes / 2);
			pcm2Volume = 1 - pcm1Volume;
		}
		var pcm1Value = pcm1.readInt16LE(i*2) * pcm1Volume;
		var pcm2Value = pcm2.readInt16LE(i*2 + pcm2Offset) * pcm2Volume;
		var val = Math.round(pcm1Value + pcm2Value);
		if (val > 32767) val = 32767;
		pcm1.writeInt16LE(val, i*2);
	}
}

var getCrossFadeOffset = function() {
	var seconds = config.crossfade;
	if (!isNaN(seconds)) {
		return seconds * 44100 * 2 * 2;
	}
}

var getDataFromStream = function(stream, done) {
	var buffer = [];
	stream.on('data', function(data) {
		buffer.push(data);
	});
	stream.on('end', function() {
		done(Buffer.concat(buffer));
	});
}

/*
16 bit pcm
44 100 sampling rate
2 channels
*/
Player.prototype.sendData = function() {
	var now = Date.now() + 800
	var timeSinceLastSendms = now - this.start;
	var end = false;
	logger.debug('needToSend: ' + timeSinceLastSendms);

	var bytesToSend = Math.ceil(timeSinceLastSendms * 44.1 * 2) * 2;
	if (bytesToSend + this.byteOffset > this.currentSongData.length -1 - getCrossFadeOffset()) {
		var limitedBytesToSend = this.currentSongData.length - getCrossFadeOffset() - this.byteOffset;
		var timeSync = limitedBytesToSend / bytesToSend;
		bytesToSend = limitedBytesToSend;
		this.start = this.start + ((now - this.start) * timeSync);
		end = true;
	}

	var tmpBuffer = new Buffer(bytesToSend);
	this.currentSongData.copy(tmpBuffer, 0, this.byteOffset, (this.byteOffset + bytesToSend));

	this.byteOffset += bytesToSend;
	if (undefined === this.encoder) {
		this.encoder = this.streamer.getEncoderInstance();
		this.encoder.pipe(this.connection, {end: false});
	}
	else if (!this.halfDoneSend && this.byteOffset > this.currentSongData.length / 2) {
		this.emit('halfDone');
		this.halfDoneSend = true;
	}

	this.encoder.write(tmpBuffer);
	if (end) {
		this.emit('songEnd');
	}
	else {
		this.start = now;
	}
}

// Gets next sound and incements songIndex
Player.prototype.nextSong = function() {
	var file = this.playlistManager.getNextSong();
	if (undefined === this.currentSong) this.currentSong = file;
	this.nextSongModel = file;
	var stream = this.streamer.decode(file.path);
	return stream;
}

Player.prototype.next = function() {
	this.currentSongData = this.nextSongData;
	this.songLength = this.currentSongData.length / 141120;
	this.byteOffset = 0;
	this.start = Date.now();
	this.halfDoneSend = false;
	this.emit('songStart');
}

Player.prototype.stop = function() {
	this.idle = true;
	clearInterval(this.interval);
}

Player.prototype.getPosition = function() {
	return {
		position: this.byteOffset / 141120,
		length: this.songLength
	}
};

module.exports = Player;
