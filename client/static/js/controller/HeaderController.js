app.controller('HeaderController', ['$scope', '$location', '$rootScope', '$interval', 'PlayerProvider',
 function($scope, $location, $rootScope, $interval, PlayerProvider) {

	var intervalId;
	$scope.progress = 0;

	$scope.isActive = function(location) {
		return location == $location.path();
	};

	var updateCurrentSong = function(data) {
		var songTitle = dataToTitle(data.current_song);
		var nextSongTitle = dataToTitle(data.coming_up);
		if ($rootScope.currentSong != songTitle || $rootScope.nextSong != nextSongTitle) {
			$rootScope.currentSong = songTitle;
			$rootScope.nextSong = nextSongTitle;
			$rootScope.position = data.position;
			$rootScope.$emit('songChanged');
		}
	};

	var getCurrentSong = function() {
		PlayerProvider.current_song(function(data) {
			updateCurrentSong(data);
		});
	};

	var resetInterval = function() {
		if (undefined !== intervalId) {
			clearInterval(intervalId);
		}

		intervalId = setInterval(getCurrentSong, 10000);
	};

	resetInterval();
	getCurrentSong();

	$scope.next = function() {
		PlayerProvider.next().$promise.then(function(response) {
			updateCurrentSong(response);
			if (response.crossfading) {
				var offset = response.offset * 10;
				var progress = 0;
				$interval(function() {
					progress += 1;
					$scope.progress = progress / offset;
					if ($scope.progress == 1) {
						$scope.progress = 0;
						getCurrentSong();
					}
				}, 100, offset)
			}
		}, function(error) {
			console.error(error);
		})
	};

	var dataToTitle = function(data) {
		var artist = data.metadata.artist || '';
		var title = data.metadata.title || '';
		seperator = (artist.length > 0 && title.length > 0) ? ' - ' : '';
		if (seperator.length > 0) {
			return artist + seperator + title;
		}
		return data.path;
	};

}]);
