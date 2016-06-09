var parser = require("mp3-parser");
var fs = require('fs');
var util = require('util');
var lame = require('lame');
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
};

Mpeg.prototype.decode = function(file) {
	var stream = fs.createReadStream(file)
	.pipe(new lame.Decoder());
	return stream;
};

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
};

Mpeg.prototype.getAudioData = function(filePath, frames, startFrame, length) {
	if (length <= 0) return new Buffer(0);
	var byteStart = startFrame === 0 ? 0 : frames[startFrame].offset;
	var lastFrame = frames[startFrame + length];
	if (lastFrame >= frames.length) lastFrame = frames.length - 1;
	var byteEnd = lastFrame.offset + lastFrame.length;
	var fd = fs.openSync(filePath, "r");
	var buffer = new Buffer(byteEnd - byteStart);
	fs.readSync(fd, buffer, 0, buffer.length, byteStart);
	fs.close(fd);

	return buffer;
};

Mpeg.prototype.getFrames = function(filePath) {
	var buffer = new DataView(toArrayBuffer(fs.readFileSync(filePath)));
	if (undefined === buffer) {
		console.error('File is null: ' + filePath);
		return false;
	}
	var firstFrame = mp3Parser.readFrame(buffer);
	var lastFrame = buffer.byteLength;
	var i = 1;
	var frames = [];
	// Locate first frame
	while (null === firstFrame) {
		i++;
		firstFrame = mp3Parser.readFrame(buffer, i, true);
	}

	frames.push({
		offset: firstFrame._section.offset,
		length: firstFrame._section.byteLength,
		sampleRate: firstFrame.header.samplingRate
	});
	var offset = firstFrame._section.nextFrameIndex;
	// Locate all other frames
	while (offset <= lastFrame) {
		var frame;
		try {
			// readFrame can throw exception in some cases
			frame = mp3Parser.readFrame(buffer, offset);
		}
		catch (err) {}
		if (frame === null || frame === undefined) {
			logger.debug(util.format('breaking at offset %s path %s', offset, filePath));
			break;
		}
		frames.push({
			offset: frame._section.offset,
			length: frame._section.byteLength
		});

		offset += frame._section.byteLength;
	}
	return frames;
};

Mpeg.prototype.encode = function(pcm) {
	var bufferStream = new stream.Transform();
	var encoder = new lame.Encoder(this.encoderConf);
	bufferStream.pipe(encoder);
	bufferStream.push(pcm);
	bufferStream.end();

	return encoder;
};

Mpeg.prototype.getEncoderInstance = function() {
	return new lame.Encoder(this.encoderConf);
};

Mpeg.prototype.getDecoderInstance = function() {
	return new lame.Decoder();
};

module.exports = Mpeg;
