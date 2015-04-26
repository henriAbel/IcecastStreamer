var express = require('express');
var server = require('server/index.js');

var playlistRouter = express.Router({mergeParams: true});

playlistRouter.route('/').get(function (request, response) {
	response.json(getManager().compile());
});

playlistRouter.route('/').post(function (request, response) {
	var name = request.body.name;
	var result = getManager().newPlaylist(name);
	response.status(result.error ? 400 : 200);
	response.json(result);
});

playlistRouter.route('/:id/').put(function (request, response) {
	var id = request.params.id;
	var playlist = request.body;
	var result = getManager().modify(playlist);

	response.status(result.error ? 400 : 200);
	response.json(result);
});

playlistRouter.route('/:id/paths').put(function (request, response) {
	var id = request.params.id;
	var paths = request.body;
	getManager().updatePlaylist(id, paths);

	response.status(200);
	response.send('Updated');
});

playlistRouter.route('/:id/queue').post(function (request, response) {
	var id = request.params.id;
	var mode = request.body.mode;
	var playlistManager = getManager();
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

playlistRouter.route('/:id/shuffle').post(function (request, response) {
	var id = request.params.id;
	var manager = getManager();
	var playlist = manager.shuffle(id);
	response.status(200);
	response.json(manager.compile(playlist.name)[0]);
});

playlistRouter.route('/:id/remove/:song').delete(function (request, response) {
	var playlistId = request.params.id;
	var songHash = request.params.song;
	var result = getManager().removeSongFromPlaylist(playlistId, songHash);
	response.status(result.error ? 400 : 200);
	response.send();
});

var getManager = function() {
	return server.getInstance().player.playlistManager;
}

module.exports = playlistRouter;
