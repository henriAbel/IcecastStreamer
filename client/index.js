var logger = require('logger')
var config = require('config/config');
var express = require('express');
var bodyParser = require('body-parser')
var router = require('./router');

var start = function() {
	var app = express();

	app.use(bodyParser.json());
	app.use('/static/', express.static(__dirname + '/static'));

	app.use('/', router);

	app.listen(config.client.port);
	logger.debug('client started');
}

module.exports.start = start;
