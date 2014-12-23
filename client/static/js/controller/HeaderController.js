app.controller('HeaderController', ['$scope', '$location', function($scope, $location) {
	$scope.isActive = function(location) {
		return location == $location.path();
	};
}]);
