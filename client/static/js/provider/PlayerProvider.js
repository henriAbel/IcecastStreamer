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
			prev: {
				method: 'GET',
				params: {
					action: 'prev'
				}
			}
		});

		return player;
	}];
});
