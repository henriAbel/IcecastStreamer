app.provider('QueueProvider', function() {
    this.$get = ['$resource', function($resource) {
        var queue = $resource(apiBase + 'queue/', {}, {
            update: {
                method: 'PUT',
            },
            query: {
                method: 'GET',
                isArray: true
            }
        });

        return queue;
    }];
});
