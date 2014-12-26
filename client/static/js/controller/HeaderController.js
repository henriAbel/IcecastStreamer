app.controller('HeaderController', ['$scope', '$location', '$rootScope', 'PlayerProvider',
 function($scope, $location, $rootScope, PlayerProvider) {

	var intervalId;
	$scope.isActive = function(location) {
		return location == $location.path();
	};

	var updateCurrentSong = function(data) {
		var songTitle = data.current_song.metadata.artist + ' - ' + data.current_song.metadata.title;
		var nextSongTitle = data.coming_up.metadata.artist + ' - ' + data.coming_up.metadata.title;
		$scope.currentSong = songTitle;
		$rootScope.currentSong = songTitle;
		$rootScope.nextSong = nextSongTitle;
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

}]);
