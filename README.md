#FMAngular

FMAngular Allows Angular to communicate with a FileMaker XML Publishing instance running on the same machine.

FMAngular converts FileMaker XML with potentially unusable field names to JavaScript objects with `$recid` and `$modid` attributes as well as `$save()` and `$delete()` methods.
 
## Sample Usage:

````javascript
fmangular.findAll({'-db': 'Tasks', '-lay': 'TasksList'}).then( function (found) {
	$scope.tasks = found;
	
	var firstTask = $scope.tasks[0];
	
	firstTask.status = 'Completed';
	
	firstTask.$save().then(function() {
		alert('Task ' + firstTask.$recid + ' has been modified ' + firstTask.$modid + ' times')
	});
});
````
	
	
##Dependencies
None.

##Quick Configuration

````javascript
// Add FMAngular and FMAngular's UI components as dependencies to your app
angular.module('your-app', ['fmangular', 'fmangular.ui']);

// Inject FMAngular into your controller
angular.module('your-app').controller('MainCtrl', function($scope, fmangular) {
  // ...
});
````


	
#Methods

##post(parameters)
Sends raw POST request to the web publishing engine, parsing any resulting records. Most FMAngular methods are convenience wrappers around `post`.

At minimum, you will want to specify `-db` and `-lay` parameters as well as an action such as `-find`, `-edit`, etc. 

##find(parameters)
Performs a find. Specify find requests in the `parameters` object, in addition to the required `-db` and `-lay` parameters. Note that find request keys must use the FileMaker field names, not the sanitized JavaScript identifiers.

##findAll(parameters)
Find all records for a `-db` and `-lay`.

##findAny(parameters)
Find a random record. Anyone actually use this?

##findQuery(parameters)
Issues a `-findQuery` post request. Consult the XML publishing guide for details on how to format this request.

##new(parameters)
Issues a `-new` post request.

#fmangular.ui
This module contains handy FileMaker-specific Angular directives.

#fm-container
Container field with drag-and-drop editing support.

    <div class="fm-container" ng-model="myRecord.myContainerField"></div>

When a file is dragged over an fm-container element an `active` class is added to the element. (This should be customizable in a future release)

## Example CSS for a container field
	
	.fm-container {
		width: 70px;
		height: 70px;
		border: 1px dashed silver;
		background-color: white;
		overflow: hidden;
		white-space: nowrap;
		text-align: center;
		display: table-cell;
		vertical-align: middle;
	}
	
	.fm-container img {
		max-height: 100%;
		max-width: 100%;
	}
	
	.fm-container.active {
		border-color:red;
	}
	
When a file is dropped onto an fm-container element, a data URL for the dropped file is written to the ng-model's value. When $save is called on your record object, this will write the base64-encoded data URL to the FileMaker container. 
The following auto-enter calculation will convert a data URL to a container field.

	/** Convert data URL e.g. "data:image/jpeg;base64,/9j/4AA..." to a container by Base64 decoding the URL */	
	If ( Left ( Self ; 5 ) ≠ "data:" ; Self ;
		Let([
			mimeType = Middle ( Self ; 6 ; Position ( Self ; ";" ; 1  ; 1 ) - 6 ) ;
			fileName = Substitute ( mimeType ; "/" ; "." ) ;
			payload = Middle( Self ; Position ( Self ; "," ; 1 ; 1 ) + 1 ; 99999999999999 )
		] ;
		Base64Decode( payload ; fileName )
		)
	)

In addition, the fm-container element supports keyboard focus. Pressing `delete` or `backspace` while focused will clear the ng-model's value.

