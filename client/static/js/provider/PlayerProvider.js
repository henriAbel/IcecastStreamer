app.provider('PlayerProvider', function() {
	this.$get = ['$resource', function($resource) {
		var player = $resource(apiBase + 'player/:action/', {action : '@action'}, {
			current_song: {
				method: 'GET',
				params: {
					action: 'current_song'
				}
			},
			next: {
				method: 'GET',
				params: {
					action: 'next'
				}
			},
			getListeners: {
				method: 'GET',
				params: {
					action: 'listeners'
				}
			}
		});

		return player;
	}];
});
