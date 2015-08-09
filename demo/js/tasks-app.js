/** App initialization */
var app = angular.module('tasksApp', [
	'ngRoute',
	'fmangular',
	'fmangular.ui'
]);

/** Configure routes to pages */
app.config(function ($routeProvider) {
	$routeProvider.when('/', {
		templateUrl: 'views/home.html'
	}).when('/tasks', {
		templateUrl: 'views/list.html',
		controller: 'ListCtrl'
	}).when('/tasks/:id', {
		templateUrl: 'views/detail.html',
		controller: 'DetailCtrl'
	}).otherwise({
		redirectTo: '/'
	})
});

app.config(function (fmangularProvider) {
	// to point FMAngular somewhere besides the local server:
	//	fmangularProvider.url('http://other.server.com/custom/path');
	//
	// to set default credentials on FMAngular requests to server:
	//fmangularProvider.credentials('username', 'secret');
});

/** List view controller */
app.controller('ListCtrl', function ($scope, fmangular, $location) {
	fmangular.findAll({'-db': 'Tasks_FMAngular', '-lay': 'Tasks'}).then(function (found) {
		$scope.tasks = found;
	}, function(err) {
		alert('Could not fetch list of tasks: ' + err.message);
	});

	$scope.newTask = function () {
		fmangular.new({ '-db': 'Tasks_FMAngular', '-lay': 'Tasks', task: 'My New Task'}).then(function (newTask) {
			$location.path('/tasks/' + newTask.$recid);
		});
	};

	/** Used to filter out empty category repeating field values */
	$scope.notEmpty = function ($v) {
		return !!$v;
	};
});

/** Detail view controller */
app.controller('DetailCtrl', function ($scope, $routeParams, $location, fmangular) {
	// important to fetch valueLists before fetching the record, so the correct option is selected.
	// alternately, hard-code your value lists
	fmangular.layout('Tasks_FMAngular', 'Task Details').then(function (layout) {
		$scope.valueLists = layout.valueLists;
	}).then(function() {
		return fmangular.find({'-db': 'Tasks_FMAngular', '-lay': 'Task Details', '-recid': $routeParams.id});
	}).then(function (found) {
		$scope.task = found[0];
	}, function (err) {
		alert('Could not locate this task: ' + err.message)
	});

	$scope.addCategory = function() {
		if ($scope.task.category.length==4) return alert('There is a maximum of four categories on the layout');
		$scope.task.category.push('');
	};

	$scope.addAssignee = function () {
		$scope.task.$performScript('Add Assignee [+]').then(handleSuccessfulSave, handleError)
	};

	$scope.addAttachment = function () {
		$scope.task.$performScript('Add Attachment [+]').then(handleSuccessfulSave, handleError)
	};

	$scope.save = function () {
		if ($scope.myForm.$invalid) {
			return alert('You must fix all validation errors first!')
		}
		$scope.task.$save().then(handleSuccessfulSave, handleError)
	};

	$scope.deleteRecord = function () {
		if (!confirm('Are you sure?')) return;
		$scope.task.$delete().then(function () {
			$location.path('/tasks');
		}).catch(function (error) {
			alert('Could not delete task: ' + error.message)
		})
	};

	function handleSuccessfulSave(updated) {
		$scope.task = updated;
		$scope.myForm.$setPristine()
	}

	function handleError(error) {
		alert('Oops! An error occurred while communicating with the database: ' + error.message || error)
	}
});