var parser = require("mp3-parser");
var fs = require('fs');
var util = require('util');
var lame = require('lame')
var stream = require("stream");
var logger = require('logger');
var config = require('config/config');
var util = require('util');
var mp3Parser = require('mp3-parser');
var stream = require("stream");

var toArrayBuffer = function (buffer) {
	var bufferLength = buffer.length, i = 0,
		uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

	for (; i < bufferLength; ++i) { uint8Array[i] = buffer[i]; }
	return uint8Array.buffer;
};

var Mpeg = function() {
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

Mpeg.prototype.decode = function(file) {
	var stream = fs.createReadStream(file)
	.pipe(new lame.Decoder);
	return stream;
}

Mpeg.prototype.decodeBuffer = function(buffer, callback) {
	var bufferStream = new stream.Transform();
	var decoder = this.getDecoderInstance();
	bufferStream.pipe(decoder);
	bufferStream.push(buffer);
	bufferStream.end();
	var bf = [];
	decoder.on('data', function(data) {
		bf.push(data);
	});
	decoder.on('end', function() {
		callback(Buffer.concat(bf));
	});
}

Mpeg.prototype.getAudioData = function(filePath, frames, startFrame, length) {
	var byteStart = startFrame == 0 ? 0 : frames[startFrame].offset;
	//var byteStart = frames[startFrame].offset;
	var lastFrame = frames[startFrame + length];
	var byteEnd = lastFrame.offset + lastFrame.length;
	var fd = fs.openSync(filePath, "r");
	var buffer = new Buffer(byteEnd - byteStart);
	fs.readSync(fd, buffer, 0, buffer.length, byteStart);
	fs.close(fd);
	return buffer;
}

Mpeg.prototype.getFrames = function(filePath) {
	var buffer = new DataView(toArrayBuffer(fs.readFileSync(filePath)));
	var firstFrame = mp3Parser.readFrame(buffer);
	var lastFrame = mp3Parser.readLastFrame(buffer);
	var i = 1;
	// Locate first frame
	while (null === firstFrame) {
		i++;
		firstFrame = mp3Parser.readFrame(buffer, i, true);
		if (i > lastFrame._section.offset) {
			console.error('Well something is not right! Will die now');
			process.exit(1);
		}
	}
	var frames = [];
	var offset = firstFrame._section.offset;
	// Locate all other frames
	while (offset <= lastFrame._section.offset) {
		var frame = mp3Parser.readFrame(buffer, offset);
		if (frame === null || frame === undefined) {
			logger.error(util.format('breaking at offset %s path %s', offset, filePath));
			break;
		}
		frames.push({
			offset: frame._section.offset,
			length: frame._section.byteLength	
		});
		offset = frame._section.nextFrameIndex;
	}
	return frames;
}

Mpeg.prototype.encode = function(pcm) {
	var bufferStream = new stream.Transform();
	var encoder = new lame.Encoder(this.encoderConf);
	bufferStream.pipe(encoder);
	bufferStream.push(pcm);
	bufferStream.end();

	return encoder;
}

Mpeg.prototype.getEncoderInstance = function() {
	return new lame.Encoder(this.encoderConf);
}

Mpeg.prototype.getDecoderInstance = function() {
	return new lame.Decoder();
}

module.exports = Mpeg;

