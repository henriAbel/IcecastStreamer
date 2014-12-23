app.controller('SongController', ['$scope', '$modal', 'SongProvider',  function($scope, $modal, SongProvider) {
	$scope.songs = SongProvider.query();

	$scope.modify = function(song) {
		var modal = $modal.open({
			templateUrl: templateUrl + 'modifySong.html',
			controller: 'ModifySongController',
			resolve: {
				song: function () {
					return song;
				}
			}
		});

		modal.result.then(function(resultSong) {
			angular.copy(resultSong, song);
		});
	};
}]);
