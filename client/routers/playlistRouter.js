var express = require('express');
var server = require('server/index.js');

var playlistRouter = express.Router({mergeParams: true});

playlistRouter.route('/').get(function (request, response) {
	response.json(server.getInstance().player.playlistManager.compile());
});

playlistRouter.route('/').post(function (request, response) {
	var name = request.body.name;
	var result = server.getInstance().player.playlistManager.newPlaylist(name);
	response.status(result.error ? 400 : 200);
	response.json(result);
});

playlistRouter.route('/:id').put(function (request, response) {
	var id = request.params.id;
	var paths = request.body;
	server.getInstance().player.playlistManager.updatePlaylist(id, paths);

	response.status(200);
	response.send('Updated');
});

playlistRouter.route('/:id/queue').post(function (request, response) {
	var id = request.params.id;
	var mode = request.body.mode;
	var playlistManager = server.getInstance().player.playlistManager;
	var result;
	if (mode == 0) {
		result = playlistManager.emptyAdd(id);
	}
	else if (mode == 1) {
		result = playlistManager.addToEnd(id);
	}
	else if (mode == 2) {
		result = playlistManager.addAfterCurrent(id);
	}
	
	if (undefined === result) {
		result = {error: true, message: 'API error! Unknown mode'};
	}
	response.status(result.error ? 400 : 200);
	response.json(result);
});

module.exports = playlistRouter;
