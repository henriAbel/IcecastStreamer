app.controller('NewPlaylistController', ['$scope', '$modalInstance', 'PlaylistProvider', 'ngToast',
	function($scope, $modalInstance, PlaylistProvider, ngToast) {

	$scope.playlist = new PlaylistProvider();

	$scope.save = function() {
		console.log($scope.playlist);
		$scope.playlist.$save().then(function(response) {
			$modalInstance.close(response);		
		}, function(error) {
			ngToast.create({
				content: error.data.message,
				className: 'danger'
			});
		});
	};
	
	$scope.close = function() {
		$modalInstance.dismiss('cancel');
	};
}]);
