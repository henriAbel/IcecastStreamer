app.provider('PlaylistProvider', function() {
    this.$get = ['$resource', function($resource) {
        var playlist = $resource(apiBase + 'playlist/:id/:action/', {id : '@id', action: '@action'}, {
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
            }
        });

        return playlist;
    }];
});
