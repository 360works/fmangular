#FMAngular by [360Works](http://360works.com)

Publish your FileMaker database to the web with no PHP back-end. Want to add a field? Just put it on your layout, and it will be available to your Angular app.

For this to work, your Angular app must be hosted on the same machine as your FileMaker XML Publishing engine, or else use the `fmangularProvider.url()` method to specify an alternate URL. Be aware that pointing to another server will require setting `Access-Control` headers on the FileMaker server. If the app and database are on the same host, there is very little configuration required to start using FMAngular. Specific steps on setting these headers are discussed here: https://github.com/360works/fmangular/issues/4

FMAngular converts FileMaker XML with potentially unusable field names to JavaScript objects with `$recid` and `$modid` attributes as well as `$save()`, `$delete()`, and `$performScript()` methods.

FileMaker dates and timestamps are parsed into native JavaScript `Date` objects, which allows correct sorting behavior. Time values are currently left as-is.

In addition, there is a handy `fm-container` directive that allows you to send upload data from the browser to FileMaker as a Base64-encoded string. 
 
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

##Detailed Configuration
````javascript
angular.module('MyApp').config(function (fmangularProvider) {
	// to point FMAngular somewhere besides the local server:
	fmangularProvider.url('http://other.server.com/custom/path');
	
	// to set default credentials on FMAngular requests to server:
	fmangularProvider.credentials('username', 'secret');
});
````


	
#FMAngular Methods

##post(parameters)
Sends raw POST request to the web publishing engine, parsing any resulting records. Most FMAngular methods are convenience wrappers around `post`. This returns a promise object containing an array of parsed record objects.

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

##layout(dbName, layoutName)
Returns a promise containing metadata about the given layout (currently only `valueLists` by name). (Thanks to Michael Wallace from rcconsulting.com for contributions here.)

#Record Methods
Most FMAngular methods return a promise containing an array of Record objects. In addition to data attributes, Records have the following methods:

## $save(optionalArgs)
Will save the record to the database, returning a promise containing the updated record.

## $delete()
Will execute a `-delete` operation for the record.
 
## $performScript(scriptName, scriptParam)
Convenience method which saves the record, passing in a `-script` and optional `-script.param` as well. Returns a promise containing the updated record.

#fmangular.ui
This module contains handy FileMaker-specific Angular directives.

##fm-container
Container field with drag-and-drop editing support.

    <div class="fm-container" ng-model="myRecord.myContainerField"></div>

When a file is dragged over an fm-container element an `active` class is added to the element. (This should be customizable in a future release)

### Example CSS for a container field
	
````css
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
````
	
### Handling uploaded files
When a file is dropped onto an fm-container element, an object whose src is the data URL for the dropped file is written to the ng-model's value. When $save is called on your record object, this will write three newline-delimited values to the FileMaker container. These values are:

* fmAngularContainer (a literal string)
* the file name
* base64-encoded file contents

The following auto-enter calculation will convert these three values to a native FileMaker container field, preserving the file name. 

	/** Convert fmAngularContainer to a FileMaker container by Base64 decoding the payload */
	
	If ( 
		getvalue ( Self ; 1 ) ≠ "fmAngularContainer" ; 
			Self ;
			Let([
				fileName = GetValue ( self ; 2 ) ;
				payload = MiddleValues( Self ; 3 ; 99999999999999 )
			] ;
			Base64Decode( payload ; fileName )
		)
	)
	
In addition, the fm-container element supports keyboard focus. Pressing `delete` or `backspace` while focused will clear the ng-model's value.

