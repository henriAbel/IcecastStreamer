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
	this.currentSong;
	this.on('songStart', function() {
		self.currentFrames = self.nextFrames || self.streamer.getFrames(self.currentSong.path);
		self.nextFrames = self.streamer.getFrames(self.nextSongModel.path);

		/*var nextSongData = self.streamer.getAudioData(self.nextSongModel.path, self.nextFrames, 0, self.crossFadedFrames)
		self.streamer.decodeBuffer(nextSongData, function(nextData) {
			self.nextSongPcm = nextData;
		});*/

		//if (self.discard) {
			/* 
				First seconds of every track is crossfaded and real track is played with offset but decoder is stupid
				and can't decode frames in random order or starting decoding from specific frame wihtout adding lots of padding.
				So let's make decoder happy and write these seconds of data and discard after they are deocded
				http://lame.sourceforge.net/tech-FAQ.txt
				https://github.com/TooTallNate/node-lame/issues/21
			*/
			//self.decoder.write(self.streamer.getAudioData(self.currentSong.path, self.currentFrames, 0, this.crossFadedFrames));
		//}
		logger.info(util.format('playing: %s', self.currentSong.path))
	})
	
	this.on('songEnd', function() {
		var now = Date.now() - self.songStart;
		var frameLen = self.currentFrames * mp3FrameDuration / 1000;
		logger.debug(util.format('song ended in %s realLen %s path %s', now, frameLen, self.currentSong.path))
		self.discard = true;
		self.next();
		self.frameIndex = self.crossFadeOffset;
		self.crossFading = false;
		self.crossFadeOffset = 0;

	});
	this.crossFadedFrames = Math.ceil(config.crossfade * 1000 / mp3FrameDuration);
	this.crossFading = false;
	//this.nextCrossFading = false;
	this.crossFadeOffset = 0;
	this.crossFadeDone = 0;
	//this.discard = false;
	this.queue1 = [];
	this.queue2 = [];
	// 0 = queue1, 1 = queue2
	this.activeDecoder = 0;
	this.switchDecoder = false;
}

Player.prototype.__proto__ = events.EventEmitter.prototype;

Player.prototype.start = function() {
	var self = this;
	// Init decoder/encoder
	if (undefined === this.encoder) {
		this.encoder = this.streamer.getEncoderInstance();
		this.encoder.pipe(this.connection, {end: false});
		this.decoder1 = this.streamer.getDecoderInstance();
		this.decoder2 = this.streamer.getDecoderInstance();
		this.decoder1.on('data', function(data) {
			self.processData(data, 1);
		});
		this.decoder2.on('data', function(data) {
			self.processData(data, 2);
		});
	}
	this.nextSong();
	this.idle = false;
	this.emit('songStart');
	this.songStart = Date.now();
	this.start = Date.now();
	this.frameIndex = 3800;
	this.interval = setInterval(function() {
		self.mainLoop();
	}, 900);
};

/*
16 bit pcm
44100 sampling rate
2 channels
*/
var crossfade = function(pcm1, pcm2, position, length) {
	console.log(util.format('pos: %s len %s', position, length));
	var bytes = pcm1.length
	var pcm1Volume = 1;
	var pcm2Volume = 0;
	var levels = Math.round(bytes / 6);
	for (var i = 0; i < bytes / 2; i++) {
		if (i % levels == 0) {
			pcm2Volume = (position + i) / length;
			if (pcm2Volume > 1) pcm2Volume = 1;
			if (pcm2Volume < 0) pcm2Volume = 0;
			pcm1Volume = 1 - pcm2Volume;
			console.log(util.format('%s - %s - %s', pcm1Volume, pcm2Volume, i));
		}
		
		var pcm1Value = pcm1.readInt16LE(i*2) * pcm1Volume;	
		var pcm2Value = pcm2.readInt16LE(i*2) * pcm2Volume;
		var val = Math.round(pcm1Value + pcm2Value);
		if (val > 32767) val = 32767;
		pcm1.writeInt16LE(val, i*2);	
	}
}

Player.prototype.mainLoop = function() {
	this.sendData();
	if (this.switchDecoder) {
		console.log('switch decoder');
		this.switchDecoder = false;
		this.crossFadeOffset = 0;
		this.crossFadeDone = 0;
		this.switchMainDecoder();
	}
	// TODO 900 to constant, why 900?
	var now = Date.now() + 900
	var timeSinceLastSendms = now - this.start;
	var self = this;
	var end = false;

	var framesToSend = Math.ceil(timeSinceLastSendms / mp3FrameDuration);
	logger.debug(util.format('Need to send: %s ms frames %s ', Math.round(timeSinceLastSendms), framesToSend));
	now += framesToSend * mp3FrameDuration - timeSinceLastSendms;

	var lastFrameIndex = this.frameIndex + framesToSend;
	if (this.currentFrames.length <= lastFrameIndex) {
		lastFrameIndex = this.currentFrames.length -1 ;
		framesToSend = lastFrameIndex - this.frameIndex;
		this.start -= (lastFrameIndex - this.currentFrames.length - 1) * mp3FrameDuration;
		end = true;
	}
	else {
		this.start = now;
	}

	console.log(this.frameIndex + ' : ' + framesToSend + ' ' + this.currentFrames.length);
	var data = this.streamer.getAudioData(this.currentSong.path, this.currentFrames, this.frameIndex, framesToSend);

	if ((framesToSend + this.frameIndex) >= (this.currentFrames.length - this.crossFadedFrames )) {
		this.crossFading = true;
		console.log('Offset: ' + this.crossFadeOffset + ' _ ' + framesToSend + ' : ' + this.crossFadedFrames);
		var nextData = this.streamer.getAudioData(this.nextSongModel.path, this.nextFrames, this.crossFadeOffset, framesToSend);
		this.getSecondaryDecoder().write(nextData);
		this.crossFadeOffset += framesToSend + 1;
		//console.log('write crossFade');
	}
	//console.log('write ok');
	this.getMainDecoder().write(data);	

	this.frameIndex += framesToSend + 1;
	if (end) {
		self.emit('songEnd');
		this.switchDecoder = true;
	}
}

Player.prototype.getMainDecoder = function() {
	return this.activeDecoder == 0 ? this.decoder1 : this.decoder2;
}

Player.prototype.getSecondaryDecoder = function() {
	return this.activeDecoder == 1 ? this.decoder1 : this.decoder2;
}

Player.prototype.switchMainDecoder = function() {
	this.activeDecoder = 1 - this.activeDecoder;
}

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
}

Player.prototype.sendData = function() {
	if (this.queue1.length <= 0 && this.queue2.length <= 0) return;
	var mainQueue = this.activeDecoder == 0 ? this.queue1 : this.queue2;
	var secondaryQueue = this.activeDecoder == 1 ? this.queue1 : this.queue2;

	

	if (mainQueue.length > 0 && secondaryQueue.length > 0) {
		console.log('crossFade');
		var data = Buffer.concat(mainQueue);
		var data2 = Buffer.concat(secondaryQueue);	
		console.log(util.format('queue1: %s queue2: %s', data.length, data2.length));
		crossfade(data, Buffer.concat(secondaryQueue), this.crossFadeDone, this.crossFadedFrames * 0.026 * 44100 * 2 * 2);
		this.crossFadeDone += data.length;
		
		this.encoder.write(data);
		secondaryQueue.length = 0;
	}
	else {
		this.encoder.write(Buffer.concat(mainQueue));	
	}

	
	mainQueue.length = 0;

	console.log('sendDone');


	/*
	if (self.crossFading) {
		if (self.crossFadeOffset + data.length > self.nextSongPcm.length) {
			// Happens with some tracks, not sure yet why
			console.error(util.format('Crossfade mismatch path %s diff %s', self.currentSong.path, (self.nextSongPcm.length - self.crossFadeOffset + data.length)));
			data = data.slice(0, self.nextSongPcm.length - self.crossFadeOffset)
		}
		crossfade(data, self.nextSongPcm.slice(self.crossFadeOffset, self.crossFadeOffset + data.length), self.crossFadeOffset, self.nextSongPcm.length);
		self.crossFadeOffset += data.length;
	}
	self.encoder.write(data);
	console.log(self.crossFadeOffset + ' ' + self.nextSongPcm.length)
	if (self.crossFadeOffset >= self.nextSongPcm.length) {
		self.emit('songEnd');
	}*/
}

// Gets next sound and incements songIndex
// TODO move to Player.next() ??
Player.prototype.nextSong = function() {
	this.currentSong = this.nextSongModel || this.playlistManager.getNextSong();
	this.nextSongModel = this.playlistManager.getNextSong();
	return this.currentSong;
}

Player.prototype.next = function() {
	this.frameIndex = 0;
	this.crossFadeData = undefined;
	this.nextSong();
	this.emit('songStart');
}

Player.prototype.stop = function() {
	this.idle = true;
	clearInterval(this.interval);
}

Player.prototype.getPosition = function() {
	return {
		position: this.frameIndex * mp3FrameDuration / 1000,
		length: this.currentFrames.length * mp3FrameDuration / 1000
	}
};

module.exports = Player;
