app.controller('ModifySongController', ['$scope', '$modalInstance', 'SongProvider', 'song',
	function($scope, $modalInstance, SongProvider, song) {

	$scope.song = angular.copy(song);

	$scope.save = function() {
		SongProvider.update({
			id: $scope.song.id,
			artist: $scope.song.metadata.artist,
			title: $scope.song.metadata.title,
			album: $scope.song.metadata.album
		}, function(response) {
			$modalInstance.close($scope.song);
		}, function(error) {
			console.log(error);
		});
	};

	$scope.close = function() {
		$modalInstance.dismiss('cancel');
	};
}]);
