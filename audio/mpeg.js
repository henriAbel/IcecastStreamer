var parser = require("mp3-parser");
var fs = require('fs');
var util = require('util');
var lame = require('lame')
var stream = require("stream");
var logger = require('logger');
var config = require('config/config');
var events = require('events');

// in ms
var streamBuffer = 1000;

var Mpeg = function(connection) {
	this.connection = connection;
	this.encoderConf = {
		// input
		channels: 2,
		bitDepth: 16,
		sampleRate: 44100,

		// output
		bitRate: 128,
		outSampleRate: 44100
	};
	events.EventEmitter.call(this);
}

Mpeg.prototype.__proto__ = events.EventEmitter.prototype;

// remove this function?
Mpeg.prototype.preapare = function(pcm, callback) {
	this.nextByteData = pcm;
	if (null !== callback) {
		callback.call(this);
	}
}

/*
16 bit pcm
44 100 sampling rate
2 channels
*/
Mpeg.prototype.sendData = function(endOfFile) {
	var self = this;
	var now = Date.now() + 800
	var timeSinceLastSendms = now - this.start;
	var end = false;
	logger.debug('needToSend: ' + timeSinceLastSendms);

	var bytesToSend = Math.ceil(timeSinceLastSendms * 44.1 * 2) * 2;

	if (bytesToSend + self.byteOffset > self.byteData.length -1 - getCrossFadeOffset()) {
		var limitedBytesToSend = self.byteData.length - getCrossFadeOffset() - self.byteOffset;
		var timeSync = limitedBytesToSend / bytesToSend;
		bytesToSend = limitedBytesToSend;
		self.start = self.start + ((now - self.start) * timeSync);
		end = true;
	}

	var tmpBuffer = new Buffer(bytesToSend);
	self.byteData.copy(tmpBuffer, 0, self.byteOffset, (self.byteOffset + bytesToSend));

	self.byteOffset += bytesToSend;
	if (undefined === this.encoder) {
		this.encoder = new lame.Encoder(this.encoderConf)
		this.encoder.pipe(self.connection, {end: false});
	}

	else if (!self.halfDoneSend && self.byteOffset > self.byteData.length / 2) {
		self.emit('halfDone');
		self.halfDoneSend = true;
	}

	this.encoder.write(tmpBuffer);
	if (end) {
		self.emit('songEnd');
		endOfFile();
	}
	else {
		self.start = now;
	}
}


Mpeg.prototype.decode = function(file) {
	var stream = fs.createReadStream(file)
	.pipe(new lame.Decoder);
	return stream;
}

Mpeg.prototype.encode = function(pcm) {
	var bufferStream = new stream.Transform();
	var encoder = new lame.Encoder(this.encoderConf);
	bufferStream.pipe(encoder);
	bufferStream.push(pcm);
	bufferStream.end();

	return encoder;
}

Mpeg.prototype.start = function(file) {
	this.start = Date.now();
	var self = this;
	if (undefined === self.byteData) {
		self.next();
	}
	this.interval = setInterval(function() {
		self.sendData(function() {
			self.next();
		});
	}, 900);
}

Mpeg.prototype.stop = function() {
	clearInterval(this.interval);
}

Mpeg.prototype.next = function() {
	this.byteData = this.nextByteData;
	this.byteOffset = 0;
	this.start = Date.now();
	this.halfDoneSend = false;
	this.emit('songStart');
};

var getCrossFadeOffset = function() {
	var seconds = config.crossfade;
	if (!isNaN(seconds)) {
		return seconds * 44100 * 2 * 2;
	}
}

var toArrayBuffer = function(buffer) {
	var bufferLength = buffer.length, i = 0,
		uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

	for (; i < bufferLength; ++i) { uint8Array[i] = buffer[i]; }
	return uint8Array.buffer;
};


module.exports = Mpeg;

