app.controller('SongController', ['$scope', 'SongProvider', 'ngToast', 'PlaylistProvider', 
	function($scope, SongProvider, ngToast, PlaylistProvider) {
	
	$scope.songs = SongProvider.query();
	$scope.playlists = PlaylistProvider.query();
	$scope.songLimit = 20;

	$scope.add = function(song) {
		SongProvider.queue({id: song.id}).$promise.then(function(result) {
			ngToast.create('Song added to queue');
		}, function(error) {
			ngToast.create({
				content: error.data.message,
				className: 'danger'
			});
		});
	};

	$scope.toPlaylist = function(song, playlist) {
		SongProvider.toPlaylist({id: song.id, pid: playlist.id}).$promise.then(function(result) {
			ngToast.create('Song added to playlist');
		}, function(error) {
			ngToast.create({
				content: error.data.message,
				className: 'danger'
			});
		});
	};
}]);
