var express = require('express');
var server = require('server/index.js');


var playerRouter = express.Router({mergeParams: true});

playerRouter.route('/current_song/').get(function (request, response) {
	response.json(server.getInstance().player.currentSong);
});

playerRouter.route('/next/').get(function (request, response) {
	server.getInstance().player.next();
	response.json(server.getInstance().player.currentSong);
});

playerRouter.route('/prev/').get(function (request, response) {
	var prevSong = server.getInstance().player.prev();
	response.json(prevSong);
});

module.exports = playerRouter;
