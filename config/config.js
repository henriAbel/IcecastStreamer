var config = {};

config.musicDir = ['/home/user/Music'];
// Seconds to crossfade tracks, set 0 to disable
config.crossfade = 5;
// If not provided, directory where run script located is used
config.playstlistDir = '';

config.commerial = {};
config.commerial.enable = true;
config.commerial.dir = ['/home/user/Commercial'];
/*
	Frequnecy consists with two numbers. First one shows how many regular songs are played until commecrial
	Second one shows how many commercials are played one time. Numbers are sperated by :
*/
config.commerial.frequency = '1:1';

config.icecast = {};
config.icecast.host = 'localhost';
config.icecast.port = '8000';
config.icecast.name = '/stream';
config.icecast.password = 'hackme';
config.icecast.encoder = 'mp3';
config.icecast.description = '';

config.client = {};
config.client.port = 8080;

module.exports = config;
