var app = angular.module('webui', ['ngRoute', 'ngResource', 'ui.bootstrap']);
var apiBase = '/api/';
var templateUrl = '/static/template/';

app.config(['$routeProvider', '$locationProvider',
		function($routeProvider, $locationProvider) {

	$routeProvider
	.when('/home/', {
		controller: 'HomeController',
		templateUrl: templateUrl + 'home.html'
	})
	.when('/music/', {
		controller: 'SongController',
		templateUrl: templateUrl + 'song.html'
	})
	.otherwise({
		redirectTo: 'home'
	});
	$locationProvider.html5Mode(true);
}]);
