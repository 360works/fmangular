fmangular
=========

FileMaker tools for Angular

Allows angular to communicate with a FileMaker XML Publishing instance running on the same machine.

    fmangular.findAll({'-db': 'Tasks', '-lay': 'TasksList'}).then(function (found) {
		$scope.tasks = found;
		
		var firstTask = $scope.tasks[0];
		
		firstTask.status = 'Completed';
		
		firstTask.$save().then(function() {alert('Task ' + firstTask.$recid + ' has been modified ' + firstTask.$modid + ' times')});
	});
	
	
