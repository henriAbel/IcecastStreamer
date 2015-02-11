app.controller('PlaylistController', ['$scope', '$modal', 'PlaylistProvider',  function($scope, $modal, PlaylistProvider) {
	$scope.playlists = PlaylistProvider.query();
	$scope.new = true;

	$scope.attrs = {
		update: function(e, ui) {
			$scope.new = false;
		}
	};

	$scope.save = function(playlist) {
		var newOrder = [];
		for (var i = playlist.files.length - 1; i >= 0; i--) {
			var e = playlist.files[i];
			newOrder.push(e.id);
		}

		PlaylistProvider.update({id: playlist.id}, newOrder);
		$scope.new = true;
		console.log(newOrder);
	};
}]);
