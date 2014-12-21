var express = require('express');
var server = require('server/index.js');


var songRouter = express.Router({mergeParams: true});
songRouter.route('/').get(function (request, response) {
	response.json(server.getInstance().player.files);
});


module.exports = songRouter;
