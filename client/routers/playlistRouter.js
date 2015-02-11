var express = require('express');
var server = require('server/index.js');

var playlistRouter = express.Router({mergeParams: true});

playlistRouter.route('/').get(function (request, response) {
	response.json(server.getInstance().player.playlistManager.compile());
});

playlistRouter.route('/:id').put(function (request, response) {
	var id = request.params.id;
	var paths = request.body;
	server.getInstance().player.playlistManager.update(id, paths);
});

module.exports = playlistRouter;
