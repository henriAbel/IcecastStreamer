app.controller('HeaderController', ['$scope', '$location', 'PlayerProvider', function($scope, $location, PlayerProvider) {
	var intervalId;
	$scope.isActive = function(location) {
		return location == $location.path();
	};

	var updateCurrentSong = function(data) {
		$scope.currentSong = data.metadata.artist + ' - ' + data.metadata.title;
	};

	var getCurrentSong = function() {
		PlayerProvider.current_song(function(data) {
			updateCurrentSong(data);
		});
	}

	var resetInterval = function() {
		if (undefined !== intervalId) {
			clearInterval(intervalId);
		}

		intervalId = setInterval(getCurrentSong, 10000);
	}

	resetInterval();
	getCurrentSong();

	$scope.next = function() {
		PlayerProvider.next(function(nextSong) {
			updateCurrentSong(nextSong);
		});
	}

	$scope.prev = function() {
		PlayerProvider.prev(function(prevSong) {
			updateCurrentSong(prevSong);
		});
	}
}]);
