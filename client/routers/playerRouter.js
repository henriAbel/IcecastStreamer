var express = require('express');
var server = require('server/index.js');


var playerRouter = express.Router({mergeParams: true});

var getSongData = function() {
	var s = server.getInstance().player;
	return {
		current_song: s.currentSong,
		coming_up: s.playlistManager.getNextSong2()
	};
};

playerRouter.route('/current_song/').get(function (request, response) {
	response.json(getSongData());
});

playerRouter.route('/next/').get(function (request, response) {
	server.getInstance().player.next();
	response.json(getSongData());
});

playerRouter.route('/listeners/').get(function (request, response) {
	response.json(server.getInstance().listeners);
});

module.exports = playerRouter;
