var logger = require('logger');

var Player = function(streamer) {
	this.streamer = streamer;
	var self = this;
	this.streamer.halfDone = function() {
		logger.debug('HalfDone');
		var song = getNextSong();
		console.log('len1: ' + self.data.length);
		var stream = self.streamer.decode(song);
		getDataFromStream(stream, function(data2) {
			console.log('len2: ' + self.data.length);
			console.log('len3: ' + data2.length);
			console.time('crossfade')
			crossfade(data2, self.data, 5);
			console.timeEnd('crossfade')
			logger.debug('Crossfading done, starting packing');
			self.streamer.preapare(data2, function() {
				self.data = data2;
			});
		});
	};
	this.playing = false;
}

Player.prototype.start = function() {
	var self = this;
	var song = getNextSong();
	console.log(song);
	var stream = this.streamer.decode(song);
	getDataFromStream(stream, function(data) {
		self.data = data;
		self.streamer.preapare(self.data, function() {
			this.start();
		});
	});
};

/*
16 bit pcm
44100 sampling rate
2 channels
*/
var crossfade = function(pcm1, pcm2, seconds) {
	var bytes = seconds * 44100 * 16 / 8 * 2;
	var pcm2Offset = pcm2.length - bytes;
	for (var i = 0; i < bytes / 2; i++) {
		var pcm1Value = pcm1.readInt16LE(i*2);
		var pcm2Value = pcm2.readInt16LE(i*2 + pcm2Offset);
		var val = Math.round(pcm1Value + pcm2Value);
		//if (val > 65535) val = 65535;
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

var b = true;
var getNextSong = function() {
	b = !b;
	if (b) {
		return '';
	}
	else {
		return '';
	}

}

module.exports = Player;
