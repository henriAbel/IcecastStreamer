var logger = require('logger');
var config = require('config/config');
var fs = require('fs');
var path = require('path');
var audioFile = require('./audioFile');
var util = require('util');

var allFiles = [];
var defaultPlaylistName = "All songs";
var i = 0;

var PlaylistManager = function() {
	this.currentSongIndex = -1;
	this.currentPlaylistIndex = 0;
	this.playlists = [];
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
					p.load(filePath);
					this.playlists.push(p);
				}
				catch (err) {
					logger.error(util.format('Cannot load playlist from "%s"', filePath));
				}
			}	
		}
	});
};

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

// Gets next sound file path, if increment is set true currentSongIndex will be incremented by 1
PlaylistManager.prototype.getNextSong = function(increment) {
	var playlist = this.playlists[this.currentPlaylistIndex];
	var nextSong;
	if (playlist.hasNext(this.currentSongIndex)) {
		nextSong = playlist.paths[this.currentSongIndex +1];
		if (increment) this.currentSongIndex++;
	}
	else {
		var playListFound = false;
		var tempIndex = this.currentPlaylistIndex +1;
		while (!playListFound) {
			if (tempIndex == this.currentPlaylistIndex) return;
			if (this.playlists.length -1 < tempIndex) {
				tempIndex = 0;
			}
			playlist = this.playlists[tempIndex];
			// Playlist has atleast 1 song
			if (playlist.hasNext(-1)) {
				playListFound = true;
				nextSong = playlist.paths[0];
				if (increment) {
					this.currentPlaylistIndex = tempIndex;
					this.currentSongIndex = 0;
				}
			}
		}
	}
	return this.getSongFromPath(nextSong);
};

PlaylistManager.prototype.getSongFromPath = function(path) {
	for (var i = allFiles.length - 1; i >= 0; i--) {
		if (allFiles[i].path == path) return allFiles[i];		
	}
	logger.error(util.format('Cannot find audioFile for path "%s"', path));
	return undefined;
};

/* 	Does same thing as getNextSong but decreases temporarily currentSongIndex.
	AudioPlayer.js always caches next song so, currentSongIndex is more like nextSongIndex.
	This function is used in web interface to show coming up song
*/
PlaylistManager.prototype.getNextSong2 = function() {
	this.currentSongIndex--;
	var nextSong = this.getNextSong(false);
	this.currentSongIndex++;
	return nextSong;
};

// Build array element for each playlist with audioFiles
PlaylistManager.prototype.compile = function() {
	var playlists = [];
	var self = this;
	this.playlists.forEach(function(playlist) {
		var files = [];
		playlist.paths.forEach(function(path) {
			var e = self.getSongFromPath(path);
			if (e !== undefined) files.push(e);
		});
		playlists.push({
			name: playlist.name,
			locked: playlist.locked,
			id: playlist.id,
			files: files
		});
	});
	return playlists;
};

PlaylistManager.prototype.getSongFromHash = function(id) {
	for (var i = allFiles.length - 1; i >= 0; i--) {
		var e = allFiles[i];
		if (e.id == id) return e;
	};
}

PlaylistManager.prototype.update = function(id, paths) {
	for (var i = this.playlists.length - 1; i >= 0; i--) {
		var playlist = this.playlists[i]
		if (playlist.id == id) {
			playlist.paths = [];
			for (var i = paths.length - 1; i >= 0; i--) {
				var e = paths[i];
				playlist.paths.push(this.getSongFromHash(e).path);
			};
			playlist.save(this.dirname);
			return;
		}
	};
};

var getAudioFiles = function(type, depth, filePaths) {
	var audioFiles = [];
	filePaths.forEach(function(filePath) {
		var files = fs.readdirSync(filePath);
		files.forEach(function(fileName) {
			if (fs.lstatSync(path.join(filePath, fileName)).isDirectory()) {
				if (depth < 2) {
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