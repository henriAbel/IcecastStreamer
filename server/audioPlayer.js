var logger = require('logger');
var config = require('config/config');
var util = require('util');
var events = require('events');
var playlistManager = require('./playlist');
var audioDeck = require('./audioDeck');
var stream = require('stream');
var fs = require('fs');

var Player = function(streamer) {
	events.EventEmitter.call(this);
	var self = this;
	this.streamer = streamer;
	this.connection = undefined;
	this.audioDecks = []
	this.audioDecks.push(this.createDeck(0));
	this.audioDecks.push(this.createDeck(1));
	this.activeDeck = 0;
	this.playlistManager = new playlistManager();
	this.playlistManager.on('stop', function() {
		logger.debug('Audioplayer has been stopped');
		self.stop();
		self.emit('stop');
	});
	this.interval = setInterval(function() {
		self.mainLoop();
	}, 600);
};

util.inherits(Player, events.EventEmitter);

Player.prototype.createDeck = function(id) {
	var deck = new audioDeck(this.streamer);
	deck.id = id;
	var self = this;
	deck.on('position', function(position) {
		if (this.state == 1 && !this.song.commercial && this.frameIndex >= this.frames.length - this.corssfadedFrames - 30) {
			this.fadeOut();
			var nextDeck = self.getNextDeck(this.id);
			self.playNext(nextDeck);
		}
	});
	deck.on('end', function() {
		self.activeDeck++;
		if (self.activeDeck >= self.audioDecks.length) self.activeDeck = 0;
		var nextDeck = self.getNextDeck(this.id);
		self.playNext(nextDeck);
	});
	return deck;
}

Player.prototype.start = function() {
	if (undefined === this.encoder) {
		this.encoder = this.streamer.getEncoderInstance();
		this.encoder.pipe(this.connection, {end: false});
	}

	var song = this.playlistManager.getNextSong();
	this.audioDecks[this.activeDeck].play(song, true);
	this.emit('songStart', song);
};

Player.prototype.mainLoop = function() {
	var min = undefined;
	// Audiodeck count which have outbuff.length > 0
	var c = 0;
	for (var i = this.audioDecks.length - 1; i >= 0; i--) {
		var len = this.audioDecks[i].outBuffer.length;
		if (len > 0) {
			min = min === undefined ? len : Math.min(min, len);
			c++;
		}
	}
	if (min > 0) {
		if (c == 1) {
			for (var i = this.audioDecks.length - 1; i >= 0; i--) {
				var e = this.audioDecks[i].outBuffer;
				if (e.length > 0) {
					this.encoder.write(new Buffer(e));
					this.audioDecks[i].outBuffer = new Buffer(0);
					break;
				}
			}
		}
		else {
			var tmpBuff = new Buffer(min);
			for (var i = 0; i < min/2; i++) {
				var value = 0;
				for (var j = this.audioDecks.length - 1; j >= 0; j--) {
					var buff = this.audioDecks[j].outBuffer;
					if (buff.length > 0) {
						value += buff.readInt16LE(i*2);	
					}
				}
				// Clipping
				if (value < -32768) value = -32768;
				if (value > 32767) value = 32767;	
				tmpBuff.writeInt16LE(value, i*2);

				
			}
			for (var j = this.audioDecks.length - 1; j >= 0; j--) {
				var e = this.audioDecks[j];
				if (e.outBuffer.length > 0) {
					e.outBuffer = new Buffer(e.outBuffer.slice(min));
				}
			}
			this.encoder.write(tmpBuff);
		}
		
	}
}

Player.prototype.playNext = function(deck) {
	if (deck.state === 0) {
		var song = this.playlistManager.getNextSong();
		deck.play(song, !song.commercial);
		this.emit('songStart', song);
	}
}


Player.prototype.next = function() {
	var deck = this.getActiveDeck();
	var e = {
		crossfading: deck.state == 1,
		offset: config.crossfade
	};
	if (deck.state == 1) {
		deck.fadeOut();
	}
	else {
		deck.stop();
	}

	return e;
};

Player.prototype.getActiveDeck = function() {
	return this.audioDecks[this.activeDeck];
}

Player.prototype.getNextDeck = function(id) {
	var nextId = id + 1;
	if (nextId >= this.audioDecks.length) {
		nextId = 0;
	}
	return this.audioDecks[nextId];
}

Player.prototype.stop = function() {
	for (var i = this.audioDecks.length - 1; i >= 0; i--) {
		this.audioDecks[i].stop();
	}
};

module.exports = Player;
