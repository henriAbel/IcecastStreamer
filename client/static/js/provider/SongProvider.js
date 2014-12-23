app.provider('SongProvider', function() {
    this.$get = ['$resource', function($resource) {
        var song = $resource(apiBase + 'song/:id/', {id : '@id'}, {
            update: {
                method: 'PUT',
            },
            query: {
                method: 'GET',
                isArray: true
            }
        });

        return song;
    }];
});
