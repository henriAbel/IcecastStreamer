var express = require('express');
var songRouter = require('./routers/songRouter');
var playerRouter = require('./routers/playerRouter');
var playlistRouter = require('./routers/playlistRouter');
var queueRouter = require('./routers/queueRouter');

var mainRouter = express.Router();
var base = __dirname + '/';

mainRouter.use('/api/song/', songRouter);
mainRouter.use('/api/player/', playerRouter);
mainRouter.use('/api/playlist/', playlistRouter);
mainRouter.use('/api/queue/', queueRouter);

mainRouter.get('/*', function(request, response) {
	response.sendFile(base + 'static/template/index.html');
});

module.exports = mainRouter;
