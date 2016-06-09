var logger = require('logger');
var config = require('config/config');
var util = require('util');
var events = require('events');
var Resampler = require('node_resampler');
var fade = require('./audioProcessors/fade');

var deckState = {
	idle: 0,
	playing: 1,
	fadeIn: 2,
	fadeOut: 3
};

var AudioDeck = function(streamer) {
	events.EventEmitter.call(this);
	var self = this;
	this.volume = 1;
	this.streamer = streamer;
	this.state = deckState.idle;
	this.processors = [];
	this.sampleRate = 44100;
	this.outBuffer = new Buffer(0);

	this.resampler = new Resampler({
		sourceRate: this.sampleRate,
		targetRate: config.audio.outSampleRate,
		stereo : true
	});

	var decoder = this.streamer.getDecoderInstance();
	this.processors.push(decoder);
	var fader = new fade(this);
	fader.on('fadeDone', function() {
		if (self.state === deckState.fadeOut) {
			self.stop();
		}
		else if (self.state === deckState.fadeIn) {
			self.state = deckState.playing;
			fader.reset();
		}
	});
	this.processors.push(fader);
	this.processors.push(this.resampler);
	this.on('songStart', function() {
		fader.reset();
	});

	// Get last processor and put data to outbuffer
	this.processors[this.processors.length - 1].on('data', function(data) {
		self.outBuffer = Buffer.concat([self.outBuffer, data]);
	});

	// Pipe everthing together
	for (var i = 0; i < this.processors.length; i++) {
		var e = this.processors[i];
		var next = this.processors[i+1];
		if (undefined !== next) {
			e.pipe(next, {end: false});
		}
	}
};

util.inherits(AudioDeck, events.EventEmitter);

AudioDeck.prototype.fadeOut = function() {
	this.state = deckState.fadeOut;
};

AudioDeck.prototype.getMore = function(time) {
	this.start -= time;
};

AudioDeck.prototype.getLess = function(time) {
	this.start += time;
};

AudioDeck.prototype.play = function(song, fadeIn) {
	if (this.state !== deckState.idle) {
		logger.error('AudioDeck already playing');
		return;
	}
	var self = this;
	self.emit('songStart', song);
	this.song = song;
	this.frames = this.streamer.getFrames(this.song.path);
	var newSampleRate = this.frames[0].sampleRate;
	if (newSampleRate !== this.sampleRate) {
		this.resampler.configure({
			sourceRate: newSampleRate,
			targetRate: config.audio.outSampleRate,
			stereo : true
		});
		this.sampleRate = newSampleRate;
		logger.debug(util.format('new sampleRate: %d', this.sampleRate));
	}
	
	if (!this.frames) {
		self.stop();
		logger.error(util.format('Cannot open file: %s', song.path));
		return;
	}
	this.start = Date.now() - 1000;
	this.frameIndex = 0;
	this.corssfadedFrames = this.getCrossfadedFrames(this.frames);
	this.interval = setInterval(function() {
		self.mainLoop();
	}, 900);
	this.state = fadeIn ? deckState.fadeIn : deckState.playing;
	if (this.state === deckState.playing && this.volume < 1) {
		this.volume = 1;
	}
	self.mainLoop();
};

/*
	Mainloop
*/
AudioDeck.prototype.mainLoop = function() {
	var now = Date.now();
	var timeSinceLastSendms = now - this.start;
	if (timeSinceLastSendms < 0)  return;
	var currentFrameDuration = this.getFrameDuration(this.frames);
	var framesToSend = Math.ceil(timeSinceLastSendms / currentFrameDuration);
	now += framesToSend * currentFrameDuration - timeSinceLastSendms;
	this.start = now;
	var lastFrameIndex = this.frameIndex + framesToSend;

	if (this.frames.length <= lastFrameIndex) {
		lastFrameIndex = this.frames.length -1 ;
		framesToSend = lastFrameIndex - this.frameIndex;
		clearInterval(this.interval);
		this.state = deckState.idle;
	}

	var data = this.streamer.getAudioData(this.song.path, this.frames, this.frameIndex, framesToSend -1);

	this.processors[0].write(data);
	if (this.state === deckState.idle) {
		this.stop();
	}

	this.frameIndex += framesToSend;
	this.position = Math.round(this.frameIndex / this.frames.length * 100);
	this.emit('position', this.position);
};

AudioDeck.prototype.stop = function() {
	this.state = deckState.idle;
	this.frames = [];
	clearInterval(this.interval);
	this.emit('end');
};

/*
	One frame duration in ms-s
*/
AudioDeck.prototype.getFrameDuration = function(frames) {
	return 1000 / frames[0].sampleRate * 1152;
};

AudioDeck.prototype.getCrossfadedFrames = function(frames) {
	return Math.ceil(config.crossfade * 1000 / this.getFrameDuration(frames));
};

AudioDeck.prototype.getPosition = function() {
	if (this.frames && this.frames.length > 0) {
		var currentFrameDuration = this.getFrameDuration(this.frames);
		return {
			position: this.frameIndex * currentFrameDuration / 1000,
			length: this.frames.length * currentFrameDuration / 1000
		};
	}
	return {};
};

module.exports = AudioDeck;


var toMillis = function(time) {
	return time[0] * 1000 + time[1] / 1000000;
}
