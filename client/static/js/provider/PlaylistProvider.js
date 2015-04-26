app.provider('PlaylistProvider', function() {
    this.$get = ['$resource', function($resource) {
        var playlist = $resource(apiBase + 'playlist/:id/:action/:param/', {id : '@id', action: '@action', param: '@param'}, {
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
            shuffle: {
                method: 'POST',
                params: {
                    action: 'shuffle'
                }
            },
            removeSong: {
                method: 'DELETE',
                params: {
                    action: 'remove'
                }
            }
        });

        return playlist;
    }];
});
