app.controller('SongController', ['$scope', 'SongProvider',  function($scope, SongProvider) {
	$scope.songs = SongProvider.query();
}]);
