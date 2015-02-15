var express = require('express');
var server = require('server/index.js');

var queueRouter = express.Router({mergeParams: true});

queueRouter.route('/').get(function (request, response) {
	var queue = server.getInstance().player.playlistManager.queue;
	response.json(queue);
});

queueRouter.route('/').put(function (request, response) {
	var paths = request.body;
	server.getInstance().player.playlistManager.reorderQueue(paths);
	response.status(200);
	response.send('Updated');
});

module.exports = queueRouter;
