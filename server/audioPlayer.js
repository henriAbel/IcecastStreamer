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
var spawn = require('child_process').spawn;

/*
	One mp3 frame is ~26ms
*/
var mp3FrameDuration = (1000 / 44100) * 1152;

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
	});
	
	this.on('songEnd', function() {
		self.discard = true;
		self.next();
		self.frameIndex = self.crossFadeOffset;
		self.crossFading = false;
		self.crossFadeOffset = 0;

	});

	this.crossFadedFrames = Math.ceil(config.crossfade * 1000 / mp3FrameDuration);
	this.crossFadedFramesByteLength = this.crossFadedFrames * 0.026 * 44100 * 2 * 2;
	this.crossFading = false;
	this.crossFadeOffset = 0;
	this.crossFadeDone = 0;
	this.queue1 = [];
	this.queue2 = [];
	this.activeDecoder = 0;
	this.switchDecoder = false;
	this.decoder1Format = 44100;
	this.decoder2Format = 44100;
};

Player.prototype.__proto__ = events.EventEmitter.prototype;

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
			if (this.decoder1Format != 44100) {
				buff.push(data);
				if (undefined !== t1) {
					clearTimeout(t1);
				}
				t1 = setTimeout(function() {
					child.stdin.write(Buffer.concat(buff));
					buff = [];
				}, 200);
				
			}
			else {
				self.processData(data, 1);	
			}
		});
		
		var child2 = this.resample(2);
		var buff2 = [];
		var t2 = undefined;
		this.decoder2.on('data', function(data) {
			if (this.decoder2Format != 44100) {
				buff2.push(data);
				if (undefined !== t2) {
					clearTimeout(t2);
				}
				t2 = setTimeout(function() {
					child2.stdin.write(Buffer.concat(buff2));
					buff2 = [];
				}, 200)
			}
			else {
				self.processData(data, 2);
			}
		});
		this.decoder1.on('format', function(format) {
			console.log(format);
			this.decoder1Format = format.sampleRate;
			console.log(this.decoder1Format);
		});
		this.decoder2.on('format', function(format) {
			console.log(format);
			this.decoder2Format = format.sampleRate;
			console.log(this.decoder2Format);
		});
	}
	this.idle = false;
	this.next();
	this.start = Date.now();
	this.frameIndex = 0;
	this.interval = setInterval(function() {
		self.mainLoop();
	}, 900);
};

Player.prototype.resample = function(encoder) {
	var self = this;
	var child = spawn('ffmpeg', ['-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:', '-f', 's16le', '-ar', '44100', '-ac', '2', 'pipe:']);
	child.stderr.on('data', function(data3) {
		//console.log(String(data3));
	})
	child.stdout.on('data', function(data2) {
		self.processData(data2, encoder)
	});
	child.stdout.on('end', function(data2) {
		
	});
	//child.stdin.write(data);
	//child.stdin.end();
	return child;
}

/*
16 bit pcm
44100 sampling rate
2 channels
*/
var crossfade = function(pcm1, pcm2, position, length) {
	var bytes = pcm1.length;
	var pcm1Volume = 1;
	var pcm2Volume = 0;
	var levels = Math.round(bytes / 6);
	for (var i = 0; i < bytes / 2; i++) {
		if (i % levels === 0) {
			pcm2Volume = (position + i) / length;
			if (pcm2Volume > 1) pcm2Volume = 1;
			if (pcm2Volume < 0) pcm2Volume = 0;
			pcm1Volume = 1 - pcm2Volume;
		}
		/*
			Sometimes decoder has Frankenstein moment and pcm is incomplete, there is nothing todo.
			Crossfade as much as possible and replace missing data with 0 value. Depending on position
			click or pause is heard one of tracks. But it's better than RangeError and quit.
		*/
		var pcm1Value = i*2 +16 < pcm1.length ? pcm1.readInt16LE(i*2) * pcm1Volume : 0;	
		var pcm2Value = i*2 +16 < pcm2.length ? pcm2.readInt16LE(i*2) * pcm2Volume : 0;
		var val = Math.round(pcm1Value + pcm2Value);
		if (val > 32767) val = 32767;
		pcm1.writeInt16LE(val, i*2);	
	}
};

Player.prototype.mainLoop = function() {
	this.sendData();
	if (this.switchDecoder) {
		this.switchDecoder = false;
		this.crossFadeOffset = 0;
		this.crossFadeDone = 0;
		this.switchMainDecoder();
	}
	// TODO 900 to constant, why 900?
	var now = Date.now() + 900;
	var timeSinceLastSendms = now - this.start;
	var self = this;
	var end = false;

	var framesToSend = Math.ceil(timeSinceLastSendms / mp3FrameDuration);
	//logger.debug(util.format('Need to send: %s ms frames %s ', Math.round(timeSinceLastSendms), (timeSinceLastSendms / mp3FrameDuration)));
	now += framesToSend * mp3FrameDuration - timeSinceLastSendms;

	var lastFrameIndex = this.frameIndex + framesToSend;
	if (this.currentFrames.length <= lastFrameIndex) {
		lastFrameIndex = this.currentFrames.length -1 ;
		framesToSend = lastFrameIndex - this.frameIndex;
		this.start -= (lastFrameIndex - this.currentFrames.length -1) * mp3FrameDuration;
		end = true;
	}
	else {
		this.start = now;
	}

	var data = this.streamer.getAudioData(this.currentSong.path, this.currentFrames, this.frameIndex, framesToSend - 1);
	if ((framesToSend + this.frameIndex) >= (this.currentFrames.length - this.crossFadedFrames )) {
		this.crossFading = true;
		var nextData = this.streamer.getAudioData(this.nextSongModel.path, this.nextFrames, this.crossFadeOffset, framesToSend - 1);
		this.getSecondaryDecoder().write(nextData);
		this.crossFadeOffset += framesToSend;
	}

	this.getMainDecoder().write(data);	
	this.frameIndex += framesToSend;

	if (end) {
		self.emit('songEnd');
		this.switchDecoder = true;
	}
};

Player.prototype.getMainDecoder = function() {
	return this.activeDecoder === 0 ? this.decoder1 : this.decoder2;
};

Player.prototype.getSecondaryDecoder = function() {
	return this.activeDecoder === 1 ? this.decoder1 : this.decoder2;
};

Player.prototype.switchMainDecoder = function() {
	this.activeDecoder = 1 - this.activeDecoder;
};

/*
	Raw PCM data which come out of decoder ends up here
*/
Player.prototype.processData = function(data, encoder) {
	var self = this;
	if (encoder == 1) {
		this.queue1.push(data);
	}
	else {
		this.queue2.push(data);
	}
};

Player.prototype.sendData = function() {
	if (this.queue1.length <= 0 && this.queue2.length <= 0) return;
	var mainQueue = this.activeDecoder === 0 ? this.queue1 : this.queue2;
	var secondaryQueue = this.activeDecoder === 1 ? this.queue1 : this.queue2;

	if (mainQueue.length > 0 && secondaryQueue.length > 0) {
		var data = Buffer.concat(mainQueue);
		crossfade(data, Buffer.concat(secondaryQueue), this.crossFadeDone, this.crossFadedFramesByteLength);
		this.crossFadeDone += data.length;
		
		this.encoder.write(data);
		secondaryQueue.length = 0;
	}
	else {
		this.encoder.write(Buffer.concat(mainQueue));	
	}

	mainQueue.length = 0;
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
		this.currentFrames.length = this.frameIndex + this.crossFadedFrames;	
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
	return {
		position: this.frameIndex * mp3FrameDuration / 1000,
		length: this.currentFrames.length * mp3FrameDuration / 1000
	};
};

module.exports = Player;
