app.controller('HomeController', ['$scope', 'PlayerProvider', function($scope, PlayerProvider) {
	var opts = {
		lines: 12,
		angle: 0.15,
		lineWidth: 0.44,
		pointer: {
			length: 0.9,
			strokeWidth: 0.035,
			color: '#21982B'
		},
		limitMax: 'false',
		percentColors: [[0.0, "#a9d70b" ], [0.50, "#f9c802"], [1.0, "#ff0000"]],
		strokeColor: '#E0E0E0',
		generateGradient: true
	};

	var target = document.getElementById('listeners');
	var gauge = new Gauge(target).setOptions(opts);
	gauge.maxValue = 10;
	gauge.set(0);

	var updateListeners = function() {
		PlayerProvider.getListeners(function(data) {
			$scope.listeners = data;
			var listeners = Number(data.icestats.source[0].listeners);
			$scope.listenerCount = listeners;
			gauge.set(listeners);
		});
	}

	setInterval(function() {
		updateListeners();
	}, 10000);
	updateListeners();
}]);
