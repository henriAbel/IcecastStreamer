app.provider('PlaylistProvider', function() {
    this.$get = ['$resource', function($resource) {
        var playlist = $resource(apiBase + 'playlist/:id/', {id : '@id'}, {
            update: {
                method: 'PUT',
            },
            query: {
                method: 'GET',
                isArray: true
            }
        });

        return playlist;
    }];
});
