var express = require('express');
var server = require('server/index.js');


var songRouter = express.Router({mergeParams: true});
songRouter.route('/').get(function (request, response) {
	response.json(server.getInstance().player.playlistManager.files);
});

songRouter.route('/:id').put(function (request, response) {
	var id = request.params.id;
	var files = server.getInstance().player.playlistManager.files;
	for (var i = 0; i < files.length; i++) {
		if (files[i].id == id) {
			files[i].updateMetadata({
				artist: request.body.artist,
				title: request.body.title,
				album: request.body.album,
			});
			break;
		}
	}
	response.status(200);
	response.send('Updated');
});

songRouter.route('/:id/queue').post(function (request, response) {
	var id = request.params.id;
	var playlistManager = server.getInstance().player.playlistManager;
	var result = playlistManager.addSongToEnd(id);
	if (undefined === result) {
		result = {error: true, message: 'API error! Unknown mode'};
	}
	response.status(result.error ? 400 : 200);
	response.json(result);
});

module.exports = songRouter;
