var parser = require("mp3-parser");
var fs = require('fs');
var util = require('util');
var lame = require('lame')
var stream = require("stream");
var logger = require('logger');
var config = require('config/config');

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

module.exports = Mpeg;

