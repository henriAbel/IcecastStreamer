var parser = require("mp3-parser");
var fs = require('fs');
var util = require('util');
var lame = require('lame')
var stream = require("stream");
var logger = require('logger');

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
}

Mpeg.prototype.preapare = function(pcm, callback) {
	console.time("preapare");
	var self = this;
	var s = this.encode(pcm);
	var buffer = [];
	s.on('data', function(data) {
		buffer.push(data);
	});
	s.on('end', function() {
		self.nextByteData = Buffer.concat(buffer);
		logger.debug('Packet data length: ' + self.nextByteData.length);
		buffer = new DataView(toArrayBuffer(self.nextByteData));
		var frames = [];

		for(var offset = 0; offset < buffer.byteLength; offset++) {
			var frame = parser.readFrame(buffer, offset)
			if (frame) {
				frames.push({offset: frame._section.offset, len: frame._section.byteLength});
				offset += frame._section.byteLength - 1;
			}
		}

		self.nextFrames = frames;
		console.log(self.nextFrames.length);
		console.timeEnd("preapare");
		if (null !== callback) {
			callback.call(self);
		}
	});

}

Mpeg.prototype.sendData = function(b, endOfFile) {
	var now = Date.now()
	var needToSend = now - this.start;
	logger.debug('needToSend: ' + needToSend);
	logger.debug('nextFrameIndex. ' + this.nextFrameIndex);
	var end = false;
	var endIndex = this.nextFrameIndex + Math.ceil(needToSend / 22.125);
	if (endIndex > (this.frames.length - 1)) {
		endIndex = this.frames.length -1
		end = true;
	}
	if (!this.halfDoneSend && endIndex > (this.frames.length / 4)) {
		console.log(endIndex + ' : ' + this.frames.length);
		this.halfDoneSend = true;
		this.halfDone();
	}
	logger.debug('Endindex: ' + endIndex + ' ' + this.frames[endIndex].offset);
	logger.debug('startindex: ' + this.nextFrameIndex + ' ' + this.frames[this.nextFrameIndex].offset);
	var dataLength = 0;
	for (var i = this.nextFrameIndex; i < endIndex; i++) {
		dataLength += this.frames[i].len;
	}
	var data = new Buffer(dataLength);
	logger.debug('datalen: ' + dataLength);
	var pointer = 0;
	for (var i = this.nextFrameIndex; i < endIndex; i++) {
		var frame = this.frames[i];
		b.copy(data, pointer, frame.offset, frame.offset + frame.len);
		pointer += frame.len;
	}

	this.start = now;
	this.nextFrameIndex = endIndex++;
	this.connection.write(data, function() {
		logger.debug('send done');
	});
	if (end) {
		console.log('end');
		endOfFile();
	}
};


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
		self.byteData = self.nextByteData;
		self.frames = self.nextFrames;
		self.nextFrameIndex = 0;
	}
	var interval = setInterval(function() {
		self.sendData(self.byteData, function() {
			console.log('callback');
			self.byteData = self.nextByteData;
			self.frames = self.nextFrames;
			self.nextFrameIndex = 0;
			this.halfDoneSend = false;
		});
	}, 1000);
}

var toArrayBuffer = function(buffer) {
	var bufferLength = buffer.length, i = 0,
		uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

	for (; i < bufferLength; ++i) { uint8Array[i] = buffer[i]; }
	return uint8Array.buffer;
};


module.exports = Mpeg;

