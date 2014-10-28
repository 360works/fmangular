angular.module('fmangular', []).provider('fmangular', function fmangularProvider() {


	this.$get = [
		'$http',
		'$q',
		'$parse',
		function ($http, $q, $parse) {
			var sanitizeFieldName = function (name, relPrefix) {
				var firstLetterIndex, firstWord, prefix, remaining, words;
				if (relPrefix && name.lastIndexOf(relPrefix, 0) === 0) {
					name = name.substr(relPrefix.length);
				}
				name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
				firstLetterIndex = name.match(/^[^a-zA-Z]*/)[0].length;
				prefix = firstLetterIndex ? '_' : '';
				words = name.substring(firstLetterIndex).match(/[a-zA-Z0-9]+/g);
				firstWord = words.shift().toLowerCase();
				while (remaining = words.shift()) {
					firstWord += remaining.charAt(0).toUpperCase() + remaining.substring(1).toLowerCase();
				}
				return prefix + firstWord;
			};

			function FMAngular() {
				var _schemas = {};

				function schemaPromiseFor(db, layout) {
					var key = db + '/' + layout;
					if (_schemas[key]) {
						return $q.when(_schemas[key])
					}
					return $http.get('/fmi/xml/fmresultset.xml?-db=' + encodeURIComponent(db) + '&-lay=' + encodeURIComponent(layout) + '-view')
							.then(parseResponse)
							.then(function (emptyResultSet) {
								return _schemas[key]; // will have been set by parseResponse
							});
				}

				/** Appends field objects from metadataElement to objectToPopulate */
				function populateMetadata(metadataElement, schema, relPrefix) {
					var toPopulate = relPrefix ? schema : schema.fields;
					for (var m = metadataElement.firstChild; m != null; m = m.nextSibling) {
						if (m.tagName == 'FIELD-DEFINITION') {
							var fmName = m.attributes['name'].value;
							var restName = fmName
							toPopulate[sanitizeFieldName(fmName, relPrefix)] = {
								fmName: fmName,
								maxRepeat: parseInt(m.attributes['max-repeat'].value),
								type: m.attributes['type'].value,
								result: m.attributes['result'].value
							};
						} else if (m.tagName == 'RELATEDSET-DEFINITION') {
							var relName = m.attributes['table'].value;
							populateMetadata(m, schema.portals[sanitizeFieldName(relName)] = {}, relName + '::');
						}
					}
					return schema;
				}

				function appendToPostData(data, fieldDef, value, portalRecId) {
					if (value === undefined || fieldDef.type !== 'normal') return data; // not writable, or never set
					if (fieldDef.result === 'container' && value !== '') {
						if (!value || value.lastIndexOf('/fmi') === 0) return data; // this is an empty container, or an FM binary object. Do not attempt to write
					}
					return data + '&' + encodeURIComponent(fieldDef.fmName) + (portalRecId ? '.' + portalRecId : '') + '=' + encodeURIComponent(value || '');
				}


				function parseResponse(response) {
					if (response.status != 200) throw {errorCode: response.error, message: 'Web Server responded with HTTP status of ' + response.error}; // FIX!!! better error message needed
					var doc = angular.element(response.data);
					var error = doc.find('error');
					if (error.attr('code') !== '0') throw {message: 'FileMaker web publishing engine returned an error code ' + error.attr('code')};
					var datasource = doc.find('datasource');
					var db = datasource.attr('database');
					var layout = datasource.attr('layout');
					var resultset = doc.find('resultset')[0];

					function _save() {
						var rec = this;
						console.log('Saving record to ' + db + ', ' + layout);
						return schemaPromiseFor(db, layout).then(function (schema) {
							var data = '-db=' + encodeURIComponent(db) + '&-lay=' + encodeURIComponent(layout) + '&-recid=' + rec.$recid + '&-modid=' + rec.$modid + '&-edit';
							angular.forEach(schema.fields, function (fv, fk) {
								data = appendToPostData(data, fv, rec[fk]);
							});
							angular.forEach(schema.portals, function (portalFieldSchema, portalName) {
								angular.forEach(rec[portalName], function (portalRow) {
									var portalRecId = portalRow.$recid || '0';
									angular.forEach(portalFieldSchema, function (pv, pk) {
										if (pv.type === 'normal') {
											data = appendToPostData(data, pv, portalRow[pk], portalRecId);
											//data += '&' + encodeURIComponent(pv.fmName) + '.' + portalRecId + '=' + encodeURIComponent(portalRow[pk] || '');
										}
									})
								})
							});
							return $http.post('/fmi/xml/fmresultset.xml', data, {headers:{'Content-Type':'application/x-www-form-urlencoded'}});
						})
								.then(parseResponse)
								.then(function (found) {
									var updatedRecord = found[0];
									rec.$modid=updatedRecord.$modid;
									return  updatedRecord
								});
					};

					function _delete() {
						var rec = this;
						console.log('Deleting record ' + db + ', ' + layout + ' ' + rec.$recid);
						var data = '-db=' + encodeURIComponent(db) + '&-lay=' + encodeURIComponent(layout) + '&-recid=' + rec.$recid + '&-modid=' + rec.$modid + '&-delete';
						return $http.post('/fmi/xml/fmresultset.xml', data).then(parseResponse);
					}

					var schemaKey = (db + '/' + layout);
					var schema = _schemas[schemaKey];
					if (!schema) {
						schema = _schemas[schemaKey] = populateMetadata(doc.find('metadata')[0], {fields: {}, portals: {}});
						console.log('Parsed metadata for ' + schemaKey);
					}

					return parseRecords(resultset, '');

					/** Recursive parser helper, returns array of fm records or portal rows */
					function parseRecords(parent, currentPortalName) {
						var toAppendTo = [];
						for (var r = parent.firstChild; r != null; r = r.nextSibling) {
							var object = {
								$recid: r.attributes['record-id'].value,
								$modid: r.attributes['mod-id'].value,
								$save: currentPortalName ? undefined : _save, // portals don't have methods
								$delete: currentPortalName ? undefined : _delete // portals don't have methods
							};
							for (var fieldOrPortal = r.firstChild; fieldOrPortal != null; fieldOrPortal = fieldOrPortal.nextSibling) {
								if (fieldOrPortal.tagName == 'FIELD') {
									var fieldName = sanitizeFieldName(fieldOrPortal.attributes['name'].value, currentPortalName);
									var value = fieldOrPortal.textContent;
									//object[fieldName] = value;
									$parse(fieldName).assign(object, value);
								} else if (fieldOrPortal.tagName == 'RELATEDSET') {
									var fmPortalName = fieldOrPortal.attributes['table'].value;
									var portalName = sanitizeFieldName(fmPortalName);
									object[portalName] = parseRecords(fieldOrPortal, fmPortalName + '::');
								} else {
									throw 'Unknown tag type: ' + fieldOrPortal.tagName
								}
							}
							toAppendTo.push(object);
						}
						return toAppendTo;

					}
				}


				this.post = function (url) {
					var httpPromise = $http.post(url);
					return httpPromise.then(function (response) {
						return parseResponse(response);
					});
				};

				var that = this;
				createConvenienceMethod('new', 'find', 'findAll', 'findAny', 'findQuery');

				function createConvenienceMethod(names) {
					angular.forEach(arguments, function (name) {
						that[name] = function (params) {
							var url = '/fmi/xml/fmresultset.xml?-' + name.toLowerCase();
							var httpPromise = $http.get(url, {params: params});
							var result = httpPromise.then(function (response) {
								return parseResponse(response);
							});
							if (name=='new') { // only return the first one
								result = result.then(function(found){return found[0]})
							}
							return result;
						}
					});
				}
			}

			return new FMAngular();
		}
	];
});

angular.module('fmangular.ui', ['fmangular']).directive('fmContainer', function ($window) {
	return {
		restrict: 'CE',
		require: 'ngModel',
		template: '<div>' +
				'<a ng-dblclick="openFile()"><img ng-src="{{src}}" ng-if="isImage" alt="{{alt}}"></a>' +
				'<span ng-if="src && !isImage">Download</span>' +
				'<span ng-if="!src">&nbsp;</span>' +
				'</div>',
		scope: {
			disabled: '@',
			width: '@',
			height: '@',
			alt: '@',
			tabindex: '@',
			dragOverClass: '@'
		},
		link: function (scope, element, attrs, ngModel) {
			element.attr('tabindex', -1);

			element.bind("keydown keypress", function (event) {
				if (event.which === 13 || event.which ==8) {
					scope.$apply(function () {
						ngModel.$setViewValue('');
						ngModel.$render();
					});

					event.preventDefault();
				}
			});
			ngModel.$render = function () {
				scope.src = ngModel.$viewValue;
				scope.isImage = scope.src && scope.src.match &&
						(scope.src.match(/^\/fmi\/xml\/cnt\/.*(gif|png|jpeg|jpg)/) || scope.src.match(/^data\:image/))
			};

			scope.openFile = function() {
				$window.open(scope.src, 'Container', {});
			}

			function dragenter(e) {
				e.stopPropagation();
				e.preventDefault();
				element.addClass('active')
			}

			function dragover(e) {
				e.stopPropagation();
				e.preventDefault();
			}

			function dragexit(e) {
				e.stopPropagation();
				e.preventDefault();
				element.removeClass('active')
			}

			function drop(e) {
				console.log('Dropped ' + e);
				e.stopPropagation();
				e.preventDefault();

				var dt = e.dataTransfer;
				var files = dt.files;

				if (files.length == 1) handleFile(files[0]);
			}

			function handleFile(file) {
				var reader = new FileReader();
				reader.onload = function (e) {
					scope.$apply(function() {
						ngModel.$setViewValue(e.target.result);
						ngModel.$render();
					})
				};
				reader.readAsDataURL(file);

			}

			element.on('dragenter', dragenter);
			element.on('dragover', dragover);
			element.on('dragleave dragexit', dragexit);
			element.on('drop', drop);

		}
	}
})