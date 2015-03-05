var app = angular.module('webui', ['ngRoute', 'ngResource', 'ui.bootstrap', 'ui.sortable', 'ngToast', 'angular-progress-arc']);
var apiBase = '/api/';
var templateUrl = '/static/template/';

app.config(['$routeProvider', '$locationProvider', 'ngToastProvider',
		function($routeProvider, $locationProvider, ngToast) {

	$routeProvider
	.when('/home/', {
		controller: 'HomeController',
		templateUrl: templateUrl + 'home.html'
	})
	.when('/music/', {
		controller: 'SongController',
		templateUrl: templateUrl + 'songList.html'
	})
	.when('/playlist/', {
		controller: 'PlaylistController',
		templateUrl: templateUrl + 'playlists.html'
	})
	.when('/queue/', {
		controller: 'QueueController',
		templateUrl: templateUrl + 'queue.html'
	})
	.otherwise({
		redirectTo: 'home'
	});
	$locationProvider.html5Mode(true);
	ngToast.configure({
		horizontalPosition: 'center'
	});
}]);
