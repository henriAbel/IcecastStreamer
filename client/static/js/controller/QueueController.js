app.controller('QueueController', ['$scope', '$modal', '$rootScope', '$interval', 'QueueProvider',  function($scope, $modal, $rootScope, $interval, QueueProvider) {
	$scope.files = QueueProvider.query();

	$scope.attrs = {
		stop: function(e, ui) {
			var newOrder = [];
			for (var i = 0; i < ui.item.sortable.sourceModel.length; i++) {
				var el = ui.item.sortable.sourceModel[i];
				newOrder.push(el.id);
			}
			if (newOrder.length > 0) {
				QueueProvider.update(newOrder);	
			}
			else {
				console.error('Error while updateting queue');
			}
		}
	};

	var interval = $interval(function() {
		$rootScope.position.position++;
		updatePosition();
	}, 1000);

	$rootScope.$on('songChanged', function() {
		$scope.files = QueueProvider.query();
		
	});

	var updatePosition = function() {
		$scope.position = $rootScope.position.position / $rootScope.position.length * 100;
		$scope.rawPosition = $rootScope.position;
		if ($scope.position > 100) $scope.position = 100;
	}

	updatePosition();

	$scope.$on('$destroy', function() {
		$interval.cancel(interval);
	});
}]);
