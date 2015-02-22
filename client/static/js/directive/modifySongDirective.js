app.directive('modifySong', ['$modal', function($modal) {
	return {
		scope: {
			modifySong: '='
		},
		link: function($scope, element, attrs) {
			element.bind('click', function() {
				var modal = $modal.open({
					templateUrl: templateUrl + 'modifySong_modal.html',
					controller: 'ModifySongController',
					resolve: {
						song: function () {
							return $scope.modifySong;
						}
					}
				});

				modal.result.then(function(resultSong) {
					angular.copy(resultSong, $scope.modifySong);
				});
			});
		}
	}
}]);