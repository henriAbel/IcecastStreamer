var server = require('server/index.js');
var client = require('client/index.js');

server.start();

client.start();

/*
On client event callback is executed and forwaded to server
Server also generates some event. E.x. song changes, playlist completed.

*/

