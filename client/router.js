var express = require('express');
var songRouter = require('./routers/songRouter');


var mainRouter = express.Router();
var base = __dirname + '/';

mainRouter.get('/', function(request, response) {
	response.sendFile(base + 'static/template/index.html');
});

mainRouter.use('/song/', songRouter);

module.exports = mainRouter;
