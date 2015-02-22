var logger = require('logger');
var config = require('config/config');
var fs = require('fs');
var path = require('path');
var audioFile = require('./audioFile');
var util = require('util');
var events = require('events');

var allFiles = [];
var playlistQueue = [];
var defaultPlaylistName = "All songs";
var i = 0;
var minQueueSize = 20;

var PlaylistManager = function() {
	this.currentSongIndex = -1;
	this.playlists = [];
	this.queue = [];
	/* Just for web usage, hold currently plaing and next song
	   Implement fixed size array in javascript trough EcmaScript 6 proxy ???
	*/
	this.dequeue = [];
	events.EventEmitter.call(this);
	this.files = getAudioFiles('.mp3', 0, config.musicDir);
	logger.debug(util.format('Found %s files in: %s', this.files.length, config.musicDir));
	allFiles = this.files;
	this.dirname = config.playstlistDir;
	if (this.dirname.length < 1) {
		this.dirname = path.join(process.cwd(), 'playlist');
		fs.mkdir(this.dirname, function(err) {
			// Directory already exists
		});
	}

	// Create default playlist which contains all songs
	var defaultPlaylist = new Playlist('All songs');
	try {
		defaultPlaylist.load(this.dirname);
	}
	catch (err) {
		console.log(err);
		logger.info('Default playlist not found, creating...');
		this.files.forEach(function(file) {
			defaultPlaylist.paths.push(file.path);
		});	
		defaultPlaylist.save(this.dirname);
	}
	
	defaultPlaylist.locked = true;
	this.playlists.push(defaultPlaylist);

	// Load all playlists
	var self = this;
	var files = fs.readdirSync(this.dirname);
	files.forEach(function(fileName) {
		// Default playlist is already created
		if (fileName != defaultPlaylistName) {
			var filePath = path.join(self.dirname, fileName);
			if (!fs.lstatSync(filePath).isDirectory()) {
				// Could be playlist
				try {
					var p = new Playlist(fileName);
					p.load(self.dirname);
					self.playlists.push(p);
				}
				catch (err) {
					logger.error(util.format('Cannot load playlist from "%s"', filePath));
				}
			}	
		}
	});
	this.updateQueue();
};

PlaylistManager.prototype.__proto__ = events.EventEmitter.prototype;

var Playlist = function(name) {
	i++;
	this.paths = [];
	this.name = name;
	// If set true, this playlist cannot be deleted
	this.locked = false;
	this.id = i;
};

Playlist.prototype.save = function(dirname) {
	fs.writeFile(path.join(dirname, this.name), JSON.stringify(this.paths), function(error) {
		if (error) logger.error(error);
	});
};

Playlist.prototype.load = function(dirname) {
	this.paths = JSON.parse(fs.readFileSync(path.join(dirname, this.name), 'utf8'));
	//console.log('cannot load: ' + path.join(this.dirname, this.name));
};

Playlist.prototype.hasNext = function(index) {
	return this.paths.length -1 > index;
};

PlaylistManager.prototype.addSong = function(songHash, playlistId) {
	var song = this._getSongFromHash(songHash);
	var playlist = this._getPlaylistFromId(playlistId);
	if (playlist.paths.indexOf(song.path) >= 0) return {
		error: true,
		message: 'Song already in playlist'
	}
	playlist.paths.push(song.path);
	playlist.save(this.dirname);
	return {error: false}
}

PlaylistManager.prototype.getNextSong = function() {
	var song = this.queue.shift();
	this.dequeue.unshift(song);
	if (this.dequeue.length > 2) {
		this.dequeue.pop();
	}
	this.updateQueue();
	return song;
};

PlaylistManager.prototype.updateQueue = function() {
	if (this.queue.length < minQueueSize) {
		var song = this._nextSong();
		if (song !== undefined) {
			this.queue.push(song);
			this.updateQueue();
		}
	}
};

PlaylistManager.prototype._nextSong = function() {
	// Prevents loops where only Chuck Norris can return value
	var antiloop = false;
	if (playlistQueue.length < 1) {
		// Default playlist
		playlistQueue.push(this.playlists[0]);
		antiloop = true;
	}
	var playlist = playlistQueue[0];
	var nextSong;
	if (playlist.hasNext(this.currentSongIndex)) {
		nextSong = playlist.paths[this.currentSongIndex +1];
		this.currentSongIndex++;
	}
	else {
		if (antiloop) {
			logger.debug('Can\'t find next song');
			this.emit('stop');
			return;
		}
		playlistQueue.shift();
		this.currentSongIndex = 0;
		return this._nextSong();
	}
	return this._getSongFromPath(nextSong);
};


PlaylistManager.prototype._getSongFromPath = function(path) {
	for (var i = allFiles.length - 1; i >= 0; i--) {
		if (allFiles[i].path == path) return allFiles[i];		
	}
	logger.error(util.format('Cannot find audioFile for path "%s"', path));
	return undefined;
};

/*  Build array element for each playlist with audioFiles
	If name is provided, only playlists with matching names are used
*/
PlaylistManager.prototype.compile = function(name) {
	var playlists = [];
	var self = this;
	this.playlists.forEach(function(playlist) {
		if (name === undefined || playlist.name == name) {
			var files = [];
			playlist.paths.forEach(function(path) {
				var e = self._getSongFromPath(path);
				if (e !== undefined) files.push(e);
			});
			playlists.push({
				name: playlist.name,
				locked: playlist.locked,
				id: playlist.id,
				files: files
			});
		}
	});
	return playlists;
};

PlaylistManager.prototype._getSongFromHash = function(id) {
	for (var i = allFiles.length - 1; i >= 0; i--) {
		var e = allFiles[i];
		if (e.id == id) return e;
	}
};

PlaylistManager.prototype._getPlaylistFromId = function(playlistId) {
	for (var i = this.playlists.length - 1; i >= 0; i--) {
		var playlist = this.playlists[i];
		if (playlist.id == playlistId) return playlist;
	}
	logger.error(util.format('can\'t find playlist with id %s', playlistId));
	return undefined;
};

PlaylistManager.prototype.updatePlaylist = function(id, paths) {
	var playlist = this._getPlaylistFromId(id);
	playlist.paths = [];
	for (i = 0; i < paths.length; i++) {
		var e = paths[i];
		playlist.paths.push(this._getSongFromHash(e).path);
	}
	playlist.save(this.dirname);
	return;
};

/*
Reorder current queue, if queue don't contain song then skip silently
*/
PlaylistManager.prototype.reorderQueue = function(newOrder) {
	var tmpQueue = [];
	var currentIds = [];
	for (var i = 0; i < this.queue.length; i++) {
		currentIds.push(this.queue[i].id);
	}
	for (var i = 0; i < newOrder.length ; i++) {
		var e = newOrder[i];
		if (currentIds.indexOf(e) >= 0) {
			tmpQueue.push(this._getSongFromHash(e));	
		}
	}
	this.queue = tmpQueue;
};

PlaylistManager.prototype.emptyAdd = function(playlistId) {
	this.queue = [];
	var playlist = this._getPlaylistFromId(playlistId);
	if (playlist === undefined) return {
		error: true,
		message: 'Playlist not found'
	};
	this.currentSongIndex = -1;
	playlistQueue = [];
	playlistQueue.push(playlist);
	this.updateQueue();
	return {
		error: false
	};
};

PlaylistManager.prototype.addToEnd = function(playlistId) {
	var result = this.addAfterCurrent(playlistId);
	if (!result.error) playlistQueue.shift();
	return result;
};

PlaylistManager.prototype.addAfterCurrent = function(playlistId) {
	var playlist = this._getPlaylistFromId(playlistId);
	if (playlist === undefined) return {
		error: true,
		message: 'Playlist not found'
	};
	for (var i = playlistQueue.length - 1; i >= 0; i--) {
		var e = playlistQueue[i];
		if (e.id == playlist.id) {
			return {
				error: true,
				message: 'Playlist already in queue'
			};
		}
	};
	playlistQueue.push(playlist);
	return {
		error: false
	};
};

PlaylistManager.prototype.addSongToEnd = function(songId) {
	var song = this._getSongFromHash(songId);
	for (var i = this.queue.length - 1; i >= 0; i--) {
		var e = this.queue[i];
		if (e.id == songId) {
			return {
				error: true,
				message: 'Song already in queue'
			};
		}
	}
	if (undefined === song) {
		return {
			error: true,
			message: 'Song not found'
		};
	}
	this.queue.push(song);
	return {
		error: false
	};
};

PlaylistManager.prototype.newPlaylist = function(name) {
	for (var i = this.playlists.length - 1; i >= 0; i--) {
		var e = this.playlists[i];
		if (e.name == name) {
			return {
				error: true,
				message: util.format('Playlist with name "%s" already exists', name)
			}
		}
	};
	var newList = new Playlist(name);
	newList.save(this.dirname);
	this.playlists.push(newList);
	return this.compile(name)[0];
};

var getAudioFiles = function(type, depth, filePaths) {
	var audioFiles = [];
	filePaths.forEach(function(filePath) {
		var files = fs.readdirSync(filePath);
		files.forEach(function(fileName) {
			if (fs.lstatSync(path.join(filePath, fileName)).isDirectory()) {
				if (depth < 0) {
					audioFiles = audioFiles.concat(getAudioFiles(type, depth +1, [path.join(filePath, fileName)]));
				}
			}
			else if (path.extname(fileName) == '.mp3') {
				audioFiles.push(new audioFile(path.join(filePath, fileName)));
			}
		});
	});
	return audioFiles;
};

module.exports = PlaylistManager;