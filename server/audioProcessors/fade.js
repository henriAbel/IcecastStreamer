var logger = require('logger');
var stream = require('stream')
var util = require('util');
var config = require('config/config');
var events = require("events");

var Fade = function(audioDeck) {
	this.deck = audioDeck;
	// samples - 16bit
	this.crossFadeDone = 0;
	stream.Transform.call(this);
	events.EventEmitter.call(this);
}

util.inherits(Fade, stream.Transform);

Fade.prototype._transform = function(chunk, encoding, done) {
	if (config.crossfade > 0) {
		// Fadein || Fadeout
		this.calcluateVolume();
		if (this.deck.volume < 1) {
			for (var i = 0; i < chunk.length/2; i++) {
				chunk.writeInt16LE(Math.round(chunk.readInt16LE(i*2) * this.deck.volume), i*2);
				this.crossFadeDone++;
				if (i % 10240 == 0) {
					this.calcluateVolume();
				}
			};
		}
		this.calcluateVolume();
	}
	this.push(chunk);
	done();
}

Fade.prototype.calcluateVolume = function() {
	if (this.deck.state == 2 || this.deck.state == 3) {
		var end = config.crossfade * 44100;
		var now = this.crossFadeDone / 2;
		var done = false;
		this.deck.volume = now / end;
		if (this.deck.volume >= 1) {
			this.deck.volume = 1;
			done = true;
		}
		// Fadeout
		if (this.deck.state == 3) {
			this.deck.volume = 1 - this.deck.volume;
		}
		// Human hearing is logarithmic
		// TODO: Needs some improvements
		/*if (this.deck.volume > 0) {
			if (this.deck.volume < 0.1) this.deck.volume = 0.1;
			this.deck.volume = Math.log(this.deck.volume * 10) / Math.LN10;
		}*/

		logger.debug(util.format('Song %s volume %d done %s', this.deck.song.path, this.deck.volume, done));
		if (done) this.emit('fadeDone');
	}
}

Fade.prototype.reset = function() {
	this.crossFadeDone = 0;
}

module.exports = Fade;
