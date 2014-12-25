var express = require('express');
var songRouter = require('./routers/songRouter');
var playerRouter = require('./routers/playerRouter');


var mainRouter = express.Router();
var base = __dirname + '/';

mainRouter.use('/api/song/', songRouter);
mainRouter.use('/api/player/', playerRouter);

mainRouter.get('/*', function(request, response) {
	response.sendFile(base + 'static/template/index.html');
});

module.exports = mainRouter;
