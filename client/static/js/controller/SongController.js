app.controller('SongController', ['$scope', 'SongProvider', 'ngToast', function($scope, SongProvider, ngToast) {
	$scope.songs = SongProvider.query();

	$scope.add = function(song) {
		SongProvider.queue({id: song.id}).$promise.then(function(result) {
			ngToast.create('Song added to queue');
		}, function(error) {
			ngToast.create({
				content: error.data.message,
				className: 'danger'
			});
		});
	}
}]);
