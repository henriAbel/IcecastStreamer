app.provider('SongProvider', function() {
    this.$get = ['$resource', function($resource) {
        var song = $resource(apiBase + 'song/:id/:action/', {id : '@id', action: '@action'}, {
            update: {
                method: 'PUT',
            },
            query: {
                method: 'GET',
                isArray: true
            },
            queue: {
                method: 'POST',
                params: {
                    action: 'queue'
                }
            },
            toPlaylist: {
                method: 'POST',
                params: {
                    action: 'playlist'
                }
            }
        });

        return song;
    }];
});
