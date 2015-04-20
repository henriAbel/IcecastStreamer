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
	this.audioDecks = [];
	this.audioDecks.push(this.createDeck(0));
	this.audioDecks.push(this.createDeck(1));
	this.playlistManager = new playlistManager();
	this.playlistManager.on('stop', function() {
		logger.debug('Audioplayer has been stopped');
		self.stop();
		self.emit('stop');
	});
	this.interval = setInterval(function() {
		self.mainLoop();
	}, 1000);
	this.retryCount = 0;
	logger.info('Audioplayer started');
};

util.inherits(Player, events.EventEmitter);

Player.prototype.createDeck = function(id) {
	var deck = new audioDeck(this.streamer);
	deck.id = id;
	var self = this;
	deck.on('position', function(position) {
		if (this.state == 1 && (!this.song.commercial || config.commercial.crossfade) 
			&& this.frameIndex >= this.frames.length - this.corssfadedFrames - 30) {

			this.fadeOut();
			if (!self.playlistManager.nextCommercial() || config.commercial.crossfade) {
				var nextDeck = self.getNextDeck(this.id);
				self.playNext(nextDeck);	
			}
		}
	});
	deck.on('end', function() {
		var nextDeck = self.getNextDeck(this.id);
		self.playNext(nextDeck);
	});
	return deck;
};

Player.prototype.start = function() {
	if (undefined === this.encoder) {
		this.encoder = this.streamer.getEncoderInstance();
		this.encoder.pipe(this.connection, {end: false});
	}

	var song = this.playlistManager.getNextSong();
	this.audioDecks[0].play(song, true);
	this.emit('songStart', song);
};

Player.prototype.mainLoop = function() {
	var min, i, j, e;
	/* 	c = Audiodeck count which have outbuff.length > 0
		p = Not idling audiodecks
	*/ 
	var c = 0, p = 0;
	for (i = this.audioDecks.length - 1; i >= 0; i--) {
		var d = this.audioDecks[i];
		var len = d.outBuffer.length;
		if (len > 0) {
			min = min === undefined ? len : Math.min(min, len);
			c++;
		}
		if (d.state > 0) {
			p++;
		}
	}
	if (min > 0) {
		if (p > c && this.retryCount < 2) {
			// Some audiodecks are still processing audio
			this.retryCount++;
			var self = this;
			logger.debug('c %d p %d r %d', c, p, this.retryCount);
			setTimeout(function() {
				self.mainLoop();
			}, 150);
			return;
		}
		if (this.retryCount > 0) {
			logger.debug('retry reset');
			this.retryCount = 0;	
		}
		if (c == 1) {
			for (i = this.audioDecks.length - 1; i >= 0; i--) {
				e = this.audioDecks[i].outBuffer;
				if (e.length > 0) {
					this.encoder.write(new Buffer(e));
					this.audioDecks[i].outBuffer = new Buffer(0);
					break;
				}
			}
		}
		else {
			var tmpBuff = new Buffer(min);
			for (i = 0; i < min/2; i++) {
				var value = 0;
				for (j = this.audioDecks.length - 1; j >= 0; j--) {
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
			for (j = this.audioDecks.length - 1; j >= 0; j--) {
				e = this.audioDecks[j];
				if (e.outBuffer.length > 0) {
					e.outBuffer = new Buffer(e.outBuffer.slice(min));
				}
			}
			this.encoder.write(tmpBuff);
		}
		
	}
};

Player.prototype.playNext = function(deck) {
	if (deck.state === 0) {
		var song = this.playlistManager.getNextSong();
		deck.play(song, !song.commercial);
		this.emit('songStart', song);
	}
};

Player.prototype.next = function() {
	logger.debug('Next called');
	var deck = this.getActiveDeck();
	var e = {
		crossfading: deck.state == 1,
		offset: config.crossfade
	};
	if (deck.state == 1) {
		deck.fadeOut();
		if (!this.playlistManager.nextCommercial() || config.commercial.crossfade) {
			var nextDeck = this.getNextDeck(deck.id);
			this.playNext(nextDeck);	
		}
	}
	else {
		deck.stop();
	}

	return e;
};

Player.prototype.getActiveDeck = function() {
	var closingDeck;
	for (var i = this.audioDecks.length - 1; i >= 0; i--) {
		var e = this.audioDecks[i];
		if (e.state === 1 || e.state === 2) return e;
		if (e.state === 3) closingDeck = e;
	}
	return e;
};

Player.prototype.getNextDeck = function(id) {
	var nextId = id + 1;
	if (nextId >= this.audioDecks.length) {
		nextId = 0;
	}
	return this.audioDecks[nextId];
};

Player.prototype.stop = function() {
	for (var i = this.audioDecks.length - 1; i >= 0; i--) {
		this.audioDecks[i].stop();
	}
};

module.exports = Player;
