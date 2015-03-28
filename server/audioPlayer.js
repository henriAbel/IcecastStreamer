var logger = require('logger');
var config = require('config/config');
var util = require('util');
var events = require('events');
var metadata = require('ffmetadata');
var audioFile = require('./audioFile');
var playlistManager = require('./playlist');
var mp3Parser = require("mp3-parser");
var stream = require("stream");
var fs = require('fs');
var Resampler = require('node_resampler');
var a = true;

var Player = function(streamer) {
	this.streamer = streamer;
	this.connection = undefined;
	this.idle = true;
	events.EventEmitter.call(this);
	var self = this;
	self.currentFrames = [];
	self.playlistManager = new playlistManager();
	self.playlistManager.on('stop', function() {
		logger.debug('Audioplayer has been stopped');
		self.stop();
		self.emit('stop');
	});

	this.on('songStart', function() {
		self.currentFrames = self.nextFrames || self.streamer.getFrames(self.currentSong.path);
		self.nextFrames = self.streamer.getFrames(self.nextSongModel.path);
		self.emit('songChange', self.currentSong);
		logger.info(util.format('playing: %s', self.currentSong.path));
		console.log('start: ' + self.currentSong.path);
	});
	
	this.on('songEnd', function() {
		self.next();
	});

	this.crossFading = false;
	this.crossFadeOffset = 0;
	this.crossFadeDone = 0;
	this.queue1Holder = {queue: new Buffer(0)};
	this.queue2Holder = {queue: new Buffer(0)};
	this.activeDecoder = 0;
	this.switchDecoder = false;
	this.decoder1Format = config.audio.outSampleRate;
	this.decoder2Format = config.audio.outSampleRate;
};

Player.prototype.__proto__ = events.EventEmitter.prototype;

/*
	One frame duration in ms-s
*/
Player.prototype.getFrameDuration = function(frames) {
	return 1000 / frames[0].sampleRate * 1152;
}

Player.prototype.getCrossfadedFrames = function(frames) {
	var frameCount = Math.ceil(config.crossfade * 1000 / this.getFrameDuration(frames));
	if (frameCount >= frames.length) {
		frameCount = Math.ceil(frames.length / 2);
	}
	return frameCount;
}

Player.prototype.start = function() {
	var self = this;
	// Init decoder/encoder
	if (undefined === this.encoder) {
		this.encoder = this.streamer.getEncoderInstance();
		this.encoder.pipe(this.connection, {end: false});
		this.decoder1 = this.streamer.getDecoderInstance();
		this.decoder2 = this.streamer.getDecoderInstance();
		var child = this.resample(1);
		var buff = [];
		var t1 = undefined;
		this.decoder1.on('data', function(data) {
			if (data.length < 1) return;
			if (this.decoder1Format != config.audio.outSampleRate) {
				buff.push(data);
				if (undefined !== t1) {
					clearTimeout(t1);
				}
				t1 = setTimeout(function() {
					console.log('write to resampler 1: ' + Buffer.concat(buff).length);
					child.write(Buffer.concat(buff));
					fs.appendFile('dataToResample.pcm', Buffer.concat(buff));
					buff = [];
				}, 1)
			}
			else {
				self.processData(data, 1);	
			}
		});
		
		var child2 = this.resample(2);
		var buff2 = [];
		var t2 = undefined;
		this.decoder2.on('data', function(data) {
			if (this.decoder2Format != config.audio.outSampleRate) {
				buff2.push(data);
				if (undefined !== t2) {
					clearTimeout(t2);
				}
				t2 = setTimeout(function() {
					console.log('write to resampler 2');
					child2.write(Buffer.concat(buff2));
					buff2 = [];
				}, 1)
			}
			else {
				self.processData(data, 2);
			}
		});
		this.decoder1.on('format', function(format) {
			console.log('decoder 1');
			console.log(format);
			this.decoder1Format = format.sampleRate;
		});
		this.decoder2.on('format', function(format) {
			console.log('decoder 2');
			console.log(format);
			this.decoder2Format = format.sampleRate;
		});
	}
	this.idle = false;
	this.next();
	this.start = Date.now();
	this.frameIndex = 0;
	setTimeout(function() {
		this.interval = setInterval(function() {
			self.mainLoop();
		}, 900);	
	}, 1500);
};

Player.prototype.resample = function(encoder) {
	var self = this;
	var resampler = new Resampler({
		sourceRate: 48000,
		targetRate: config.audio.outSampleRate,
		stereo : true
	});
	resampler.on('data', function(data2) {
		console.log('data from resample');
		if (encoder == 1) {
			fs.appendFile('dataFromResample' + encoder + '.pcm', data2);
		}
		self.processData(data2, encoder)
	});
	return resampler;
}

/*
16 bit pcm
44100/48000 sampling rate
2 channels
*/
var crossfade = function(pcm1, pcm2, position, length) {
	var bytes = pcm1.length;
	var pcm1Volume = 1;
	var pcm2Volume = 0;
	var levels = Math.round(bytes / 12);
	for (var i = 0; i < bytes / 2; i++) {
		if (i % levels === 0) {
			pcm2Volume = (position + i*2) / length;
			if (pcm2Volume > 1) pcm2Volume = 1;
			if (pcm2Volume < 0) pcm2Volume = 0;
			pcm1Volume = 1 - pcm2Volume;
			console.log(util.format('%s - %s', pcm1Volume, pcm2Volume));
		}
		/*
			Sometimes decoder has Frankenstein moment and pcm is incomplete, there is nothing todo.
			Crossfade as much as possible and replace missing data with 0 value. Depending on position
			click or pause is heard one of tracks. But it's better than RangeError and quit.
			TODO pcm1 and pcm2 are now always same length due to "smart corssfade" ?????
		*/
		var pcm1Value = i*2 +16 < pcm1.length ? pcm1.readInt16LE(i*2) * pcm1Volume : 0;	
		var pcm2Value = i*2 +16 < pcm2.length ? pcm2.readInt16LE(i*2) * pcm2Volume : 0;
		var val = Math.round(pcm1Value + pcm2Value);
		if (val > 32767) val = 32767;
		try {
			pcm1.writeInt16LE(val, i*2);	
		}
		catch (err) {
			console.log(err);
			console.log(i*2);
		}
		
	}
};

Player.prototype.mainLoop = function() {
	this.sendData();
	if (this.switchDecoder) {
		this.switchDecoder = false;
		this.crossFadeDone = 0;		
		this.frameIndex = this.crossFading ? this.crossFadeOffset : 0;
		this.crossFading = false;
		this.crossFadeOffset = 0;
		this.switchMainDecoder();
		console.log('switch');
	}
	// TODO 900 to constant, why 900?
	var now = Date.now() + 900;
	var timeSinceLastSendms = now - this.start;
	var self = this;
	var end = false;
	var currentFrameDuration = this.getFrameDuration(this.currentFrames);
	var framesToSend = Math.ceil(timeSinceLastSendms / currentFrameDuration);
	console.log(util.format('Need to send: %s ms frames %s frameindex %s', Math.round(timeSinceLastSendms), Math.ceil(timeSinceLastSendms / this.getFrameDuration(this.currentFrames))), this.frameIndex);
	now += framesToSend * currentFrameDuration - timeSinceLastSendms;

	var lastFrameIndex = this.frameIndex + framesToSend;
	if (this.currentFrames.length <= lastFrameIndex) {
		lastFrameIndex = this.currentFrames.length -1 ;
		framesToSend = lastFrameIndex - this.frameIndex;
		this.start -= (this.frameIndex + framesToSend - this.currentFrames.length -1) * currentFrameDuration;
		end = true;
	}
	else {
		this.start = now;
	}

	var data = this.streamer.getAudioData(this.currentSong.path, this.currentFrames, this.frameIndex, framesToSend - 1);
	if (!this.crossFading && (framesToSend + this.frameIndex) >= (this.currentFrames.length - this.getCrossfadedFrames(this.currentFrames))) {
		var isCommercial = this.nextSongModel.commercial || this.currentSong.commercial;
		if ((isCommercial && config.commercial.crossfade) || !isCommercial) {
			this.crossFading = true;
			this.crossFadeOffset = this.getCrossfadedFrames(this.nextFrames);
			this.crossFadeLength = Math.ceil(1000 / this.nextFrames[0].sampleRate * 1152 * this.crossFadeOffset * 2 * 2 * config.audio.outSampleRate / 1000);
			var nextData = this.streamer.getAudioData(this.nextSongModel.path, this.nextFrames, 0, this.crossFadeOffset);
			this.getSecondaryDecoder().write(nextData);
		}
	}

	this.getMainDecoder().write(data);	
	this.frameIndex += framesToSend;

	if (end) {
		self.emit('songEnd');
		this.switchDecoder = true;
	}
};

/*
	Raw PCM data which come out of decoder/resampler ends up here
*/
Player.prototype.processData = function(data, encoder) {
	var self = this;
	if (encoder == 1) {
		this.queue1Holder.queue = Buffer.concat([this.queue1Holder.queue, data]);
	}
	else {
		this.queue2Holder.queue = Buffer.concat([this.queue2Holder.queue, data]);
	}
};

Player.prototype.sendData = function() {
	var mainQueue = this.getMainQueue().queue;
	var secondaryQueue = this.getSecondaryQueue().queue;

	if (mainQueue.length <= 0 && secondaryQueue.length <= 0) {
		console.log('both empty');
		return;
	}
	
	if (mainQueue.length > 0 && secondaryQueue.length > 0) {
		console.log('sec: ' + secondaryQueue.length);
		if (mainQueue.length == secondaryQueue.length) {
			crossfade(mainQueue, secondaryQueue, this.crossFadeDone, this.crossFadeLength);
			this.crossFadeDone += mainQueue.length;
			
			this.encoder.write(mainQueue);
			this.getMainQueue().queue = new Buffer(0);
			this.getSecondaryQueue().queue = new Buffer(0);
		}
		else {
			var maxToSend = Math.min(mainQueue.length, secondaryQueue.length);
			var pcm1Data = mainQueue.slice(0, maxToSend);
			var pcm2Data = secondaryQueue.slice(0, maxToSend);
			crossfade(pcm1Data, pcm2Data, this.crossFadeDone, this.crossFadeLength);
			this.crossFadeDone += maxToSend;
			this.encoder.write(pcm1Data);
			this.getMainQueue().queue = mainQueue.slice(maxToSend);
			this.getSecondaryQueue().queue = secondaryQueue.slice(maxToSend);
			console.log('seconday len: ' + this.getSecondaryQueue().queue.length);
		}
	}
	else {
		this.encoder.write(mainQueue);	
		this.getMainQueue().queue = new Buffer(0);
	}	
};

Player.prototype.next = function() {
	this.frameIndex = 0;
	this.crossFadeData = undefined;
	this.currentSong = this.nextSongModel || this.playlistManager.getNextSong();
	this.nextSongModel = this.playlistManager.getNextSong();
	this.emit('songStart');
};

/*
	Change to next song with crossfading
	Overwrites current song length to current position + corssfaded frames
*/
Player.prototype.softNext = function() {
	if (this.crossFading === true) {
		this.next();
		this.crossFading = false;
		return {
			crossfading: false,
		};
	}
	else {
		this.currentFrames.length = this.frameIndex + this.getCrossfadedFrames(this.currentFrames);
		return {
			crossfading: true,
			offset: config.crossfade
		};
	}
};

Player.prototype.stop = function() {
	this.idle = true;
	clearInterval(this.interval);
};

Player.prototype.getPosition = function() {
	var currentFrameDuration = this.getFrameDuration(this.currentFrames);
	return {
		position: this.frameIndex * currentFrameDuration / 1000,
		length: this.currentFrames.length * currentFrameDuration / 1000
	};
};

Player.prototype.getMainDecoder = function() {
	return this.activeDecoder === 0 ? this.decoder1 : this.decoder2;
};

Player.prototype.getSecondaryDecoder = function() {
	return this.activeDecoder === 1 ? this.decoder1 : this.decoder2;
};

Player.prototype.getMainQueue = function() {
	return this.activeDecoder === 0 ? this.queue1Holder : this.queue2Holder;
};

Player.prototype.getSecondaryQueue = function() {
	return this.activeDecoder === 1 ? this.queue1Holder : this.queue2Holder;
};

Player.prototype.switchMainDecoder = function() {
	this.activeDecoder = 1 - this.activeDecoder;
};

module.exports = Player;
