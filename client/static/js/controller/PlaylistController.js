app.controller('PlaylistController', ['$scope', '$modal', 'PlaylistProvider', 'ngToast',  function($scope, $modal, PlaylistProvider, ngToast) {
	$scope.playlists = PlaylistProvider.query();
	$scope.new = true;

	$scope.attrs = {
		update: function(e, ui) {
			$scope.new = false;
		}
	};

	/*
	Saves current playlist
	*/
	$scope.save = function(playlist) {
		var newOrder = [];
		for (var i = 0; i < playlist.files.length; i++) {
			var e = playlist.files[i];
			newOrder.push(e.id);
		}

		PlaylistProvider.update({id: playlist.id}, newOrder);
		$scope.new = true;
	};

	/*
	Adds playlist to queue
	*/
	$scope.add = function(playlist, mode) {
		PlaylistProvider.queue({id: playlist.id, mode: parseInt(mode)}).$promise.then(function(response){
			ngToast.create('Playlist added to queue');
		}, function(error) {
			ngToast.create({
				content: error.data.message,
				className: 'danger'
			});
		});
	};

	$scope.newPlaylist = function() {
		var modal = $modal.open({
			templateUrl: templateUrl + 'newPlaylist_modal.html',
			controller: 'NewPlaylistController',
		});

		modal.result.then(function(playlist) {
			if (undefined !== playlist) {
				$scope.playlists.push(playlist);	
			}
		});
	};

	$scope.shuffle = function(playlist) {
		PlaylistProvider.shuffle({id: playlist.id}).$promise.then(function(response) {
			playlist.files = response.files;
		}, function(error) {
			console.error(error);
		});
	}
}]);
