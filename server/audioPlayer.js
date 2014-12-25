var logger = require('logger');
var config = require('config/config');
var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var metadata = require('ffmetadata');
var audioFile = require('./audioFile');

var Player = function(streamer) {
	this.streamer = streamer;
	events.EventEmitter.call(this);
	var self = this;
	self.songIndex = 0;
	self.files = getAudioFiles('.mp3', 0, config.musicDir);
	logger.debug(util.format('Found %s files in: %s', self.files.length, config.musicDir));
	this.streamer.on('songStart', function() {
		self.currentSong = self.nextSongModel;
		self.emit('songChange', self.currentSong);
		var stream = self.getNextSong();
		getDataFromStream(stream, function(data2) {
			console.time('crossfade')
			crossfade(data2, self.data, config.crossfade);
			console.timeEnd('crossfade')
			self.streamer.preapare(data2, function() {
				self.data = data2;
			});
		});
	})
	this.playing = false;
}

Player.prototype.__proto__ = events.EventEmitter.prototype;

Player.prototype.start = function() {
	var self = this;
	var stream = self.getNextSong();
	getDataFromStream(stream, function(data) {
		self.data = data;
		self.streamer.preapare(self.data, function() {
			this.start();
		});
	});
};

var getAudioFiles = function(type, depth, filePaths) {
	var audioFiles = [];
	filePaths.forEach(function(filePath) {
		var files = fs.readdirSync(filePath);
		files.forEach(function(fileName) {
			if (fs.lstatSync(path.join(filePath, fileName)).isDirectory()) {
				if (depth < 2) {
					audioFiles = audioFiles.concat(getAudioFiles(type, depth +1, [path.join(filePath, fileName)]));
				}
			}
			else if (path.extname(fileName) == '.mp3') {
				audioFiles.push(new audioFile(path.join(filePath, fileName)));
			}
		})
	});
	return audioFiles;
}

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


var getDataFromStream = function(stream, done) {
	var buffer = [];
	stream.on('data', function(data) {
		buffer.push(data);
	});
	stream.on('end', function() {
		done(Buffer.concat(buffer));
	});
}

Player.prototype.getNextSong = function() {
	var model = this.getNextSongModel();
	if (undefined === this.currentSong) this.currentSong = model;
	var stream = this.streamer.decode(model.path);
	return stream;
}

Player.prototype.getNextSongModel = function() {
	var file = this.files[this.songIndex]
	this.songIndex++;
	if (this.songIndex > this.files.length - 1) {
		this.songIndex = 0;
	}
	return file;
};

Player.prototype.next = function() {
	this.streamer.next();
}

Player.prototype.stop = function() {
	this.streamer.stop();
}

Player.prototype.prev = function() {
	var self = this;
	/* If song starts, next on is loaded right away
	 * -1 is next song, -2 is current song, -3 is previous song
	 */
	self.songIndex = self.songIndex - 3;
	if (self.songIndex < 0) self.songIndex = self.songIndex + self.files.length;
	var stream = self.getNextSong();
	getDataFromStream(stream, function(data) {
		self.data = data;
		self.streamer.preapare(self.data, function() {
			this.next();
		});
	});
	// Because async
	return this.nextSongModel;
}

module.exports = Player;
