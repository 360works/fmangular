angular.module('fmangular', []).provider('fmangular', function fmangularProvider() {


	this.$get = [
		'$http',
		'$q',
		'$parse',
		'$filter',
		function ($http, $q, $parse, $filter) {
			var dateFilter = $filter('date');
			var datePattern = /^(\d\d?)\/(\d\d?)\/(\d{2,4})/;
			var timestampPattern = /^(\d\d?)\/(\d\d?)\/(\d{2,4}) +(\d\d?):(\d\d?):(\d\d?)/;

			function sanitizeFieldName(name, relPrefix) {
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
			}

			function parseContainer(value) {
				if (!value) return null;
				return {type:'fmContainer',src:value,filename:value.match(/([^\/?]+)\?/)[1]}
			}

			function parseDate(value, format) {
				if (!value) return null;
				if (window.moment) {
					return window.moment(value, format).getTime();
				} else if (format === 'MM/dd/yyyy') {
					var match = datePattern.exec(value);
					if (match) {
						var year = parseInt(match[3]);
						if (year < 1000) {
							year += 2000;
						}
						//return year + '-' + pad(match[1]) + '-' + pad(match[2]);
						return new Date(year, parseInt(match[1])-1, parseInt(match[2]));
					} else {
						console.error("Could not parse date: " + value);
						return value;
					}
				} else if (format === 'MM/dd/yyyy HH:mm:ss') {
					var match = timestampPattern.exec(value);
					if (match) {
						var year = parseInt(match[3]);
						if (year < 1000) {
							year += 2000;
						}
						//return year + '-' + pad(match[1]) + '-' + pad(match[2]);
						return new Date(year, parseInt(match[1])-1, parseInt(match[2]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]));
					} else {
						console.error("Could not parse date: " + value);
						return value;
					}

				}
			}

			function formatDate(value, format) {
				return value ? dateFilter(value, format) : '';
			}

			function FMAngular() {
				var _schemas = {};

				function schemaPromiseFor(db, layout) {
					var key = db + '/' + layout;
					if (_schemas[key]) {
						return $q.when(_schemas[key])
					}
					return $http.get('/fmi/xml/fmresultset.xml?-db=' + encodeURIComponent(db) + '&-lay=' + encodeURIComponent(layout) + '-view')
							.then(parseResponse)
							.then(function () {
								return _schemas[key]; // will have been set by parseResponse
							});
				}

				/** Appends field objects from metadataElement to objectToPopulate */
				function populateMetadata(metadataElement, schema, relPrefix) {
					var toPopulate = relPrefix ? schema : schema.fields;
					for (var m = metadataElement.firstChild; m != null; m = m.nextSibling) {
						if (m.tagName == 'FIELD-DEFINITION') {
							var fmName = m.attributes['name'].value;
							var restName = fmName;
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

				function appendToPostData(data, fieldDef, value, portalRecId, schema, repetition) {
					if (value === undefined || fieldDef.type !== 'normal') return data; // not writable, or never set
					if (fieldDef.maxRepeat > 1 && angular.isArray(value)) {
						for (var i=0; i<value.length; i++) {
							data = data + appendToPostData(data, fieldDef, value[i], portalRecId, schema, i+1);
						}
						return data;
					} else if (fieldDef.result === 'container' && value && value.type==='fmContainer') {
						return data; // this is an FM binary object. Do not attempt to write, as it hasn't changed since we fetched it
					} else if (fieldDef.result === 'container' && value && value.type==='jsContainer') {
						value = 'fmAngularContainer\n' + value.filename + '\n' + value.src.substr(value.src.indexOf(',')+1); // send the filename and data URL to FileMaker, where it will be extracted using base64 encoding
					} else if (fieldDef.result === 'date' && angular.isDate(value)) {
						value = formatDate(value, schema.dateFormat);
					} else if (fieldDef.result === 'timestamp' && angular.isDate(value)) {
						value = formatDate(value, schema.timestampFormat);
					}
					return data + '&' + encodeURIComponent(fieldDef.fmName) + (repetition ? '(' + repetition + ')' : '') + (portalRecId ? '.' + portalRecId : '') + '=' + encodeURIComponent(value || '');
				}


				function docForResponse(response) {
					if (response.status != 200) throw {errorCode: response.error, message: 'Web Server responded with HTTP status of ' + response.error}; // FIX!!! better error message needed
					return angular.element(response.data);
				}

				function errorMessageFor(errorCode) {
					switch(errorCode) {
						case 2: return 'Memory error';
						case 3: return 'Command is unavailable (for example, wrong operating system, wrong mode, etc.)';
						case 4: return 'Command is unknown';
						case 5: return 'Command is invalid (for example, a Set Field script step does not have a calculation specified)';
						case 6: return 'File is read-only';
						case 7: return 'Running out of memory';
						case 8: return 'Empty result';
						case 9: return 'Insufficient privileges';
						case 10: return 'Requested data is missing';
						case 11: return 'Name is not valid';
						case 100: return 'File is missing';
						case 101: return 'Record is missing';
						case 102: return 'Field is missing';
						case 103: return 'Relationship is missing';
						case 104: return 'Script is missing';
						case 105: return 'Layout is missing';
						case 106: return 'Table is missing';
						case 200: return 'Record access is denied';
						case 201: return 'Field cannot be modified';
						case 202: return 'Field access is denied';
						case 300: return 'File is locked or in use';
						case 301: return 'Record is in use by another user';
						case 302: return 'Table is in use by another user';
						case 303: return 'Database schema is in use by another user';
						case 304: return 'Layout is in use by another user';
						case 306: return 'Record modification ID does not match';
						case 400: return 'Find criteria are empty';
						case 500: return 'Date value does not meet validation entry options';
						case 501: return 'Time value does not meet validation entry options';
						case 502: return 'Number value does not meet validation entry options';
						case 503: return 'Value in field is not within the range specified in validation entry options';
						case 504: return 'Value in field is not unique as required in validation entry options';
						case 505: return 'Value in field is not an existing value in the database file as required in validation entry options';
						case 506: return 'Value in field is not listed on the value list specified in validation entry option';
						case 507: return 'Value in field failed calculation test of validation entry option';
						case 508: return 'Invalid value entered in Find mode';
						case 509: return 'Field requires a valid value';
						case 800: return 'Unable to create file on disk';
						case 801: return 'Unable to create temporary file on System disk';
						case 802: return 'Unable to open file.';
						case 8003: return 'Record is locked by another user.';
						default: return 'FileMaker web publishing engine returned an error code ' + errorCode;
					}
				}

				function parseLayoutXml(response) {
					var doc = docForResponse(response);
					var errorcode = doc.find('errorcode');
					if (!errorcode || !errorcode.length) throw {message:'Response from server is not a valid layout document'};
					if (errorcode[0].textContent !== '0') {
						var errorCodeNum = parseInt(errorcode[0].textContent);
						throw {message:errorMessageFor(errorCodeNum),code:errorCodeNum};
					}
					var result = {valueLists:{}};

					var valueLists = doc.find('valuelist');
					angular.forEach(valueLists, function(vl) {
						var vlName = sanitizeFieldName(vl.attributes.name.value);
						var groupIndex = 0;
						if (!vlName) return;
						var items = result.valueLists[ vlName] = [];
						for (var v = vl.firstChild; v != null; v = v.nextSibling) {
							if (v.textContent==='-') { // a divider
								groupIndex++;
							} else {
								items.push({groupIndex: groupIndex, display: v.attributes.display.value, value: v.textContent});
							}
						}
					});
					return result;
				}

				function parseResponse(response) {
					var doc = docForResponse(response);
					var error = doc.find('error');
					if (!error) throw {message:'Response from server is not a valid resultset document'};
					if (error.attr('code') !== '0') {
						var errorCodeNum = parseInt(error.attr('code'));
						throw {message: errorMessageFor(errorCodeNum), code:errorCodeNum};
					}
					var datasource = doc.find('datasource');
					var db = datasource.attr('database');
					var layout = datasource.attr('layout');
					var resultset = doc.find('resultset')[0];

					var _save = function(additionalArgs) {
						var rec = this;
						return schemaPromiseFor(db, layout).then(function (schema) {
							var data = '-db=' + encodeURIComponent(db) + '&-lay=' + encodeURIComponent(layout) + '&-recid=' + rec.$recid + '&-modid=' + rec.$modid + '&-edit';
							angular.forEach(additionalArgs, function (fv, fk) {
								data += '&' + encodeURIComponent(fk) + '=' + encodeURIComponent(fv);
							});
							angular.forEach(schema.fields, function (fv, fk) {
								data = appendToPostData(data, fv, rec[fk], null, schema);
							});
							angular.forEach(schema.portals, function (portalFieldSchema, portalName) {
								angular.forEach(rec[portalName], function (portalRow) {
									var portalRecId = portalRow.$recid || '0';
									angular.forEach(portalFieldSchema, function (pv, pk) {
										if (pv.type === 'normal') {
											data = appendToPostData(data, pv, portalRow[pk], portalRecId, schema);
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

					var _delete = function() {
						var rec = this;
						var data = '-db=' + encodeURIComponent(db) + '&-lay=' + encodeURIComponent(layout) + '&-recid=' + rec.$recid + '&-modid=' + rec.$modid + '&-delete';
						return $http.post('/fmi/xml/fmresultset.xml', data).then(parseResponse);
					};

					var _scriptInvoker = (function(db, layout, parseFn) {
						return function(script, parameter) {
							return this.$save({'-script':script,'-script.param':parameter});
						};
					})(db, layout, parseResponse);


					var schemaKey = (db + '/' + layout);
					var schema = _schemas[schemaKey];
					if (!schema) {
						schema = _schemas[schemaKey] = populateMetadata(doc.find('metadata')[0], {fields: {}, portals: {}});
						schema.dateFormat = datasource.attr('date-format');
						schema.timeFormat = datasource.attr('time-format');
						schema.timestampFormat = datasource.attr('timestamp-format');
					}

					return parseRecords(resultset, '');

					/** Recursive parser helper, returns array of fm records or portal rows */
					function parseRecords(parent, fmPortalName, jsPortalName) {
						var currentSchema = jsPortalName ? schema.portals[jsPortalName] : schema.fields;
						var toAppendTo = [];
						for (var r = parent.firstChild; r != null; r = r.nextSibling) {
							var object = {
								$recid: r.attributes['record-id'].value,
								$modid: r.attributes['mod-id'].value,
								$save: fmPortalName ? undefined : _save, // portals don't have methods
								$delete: fmPortalName ? undefined : _delete, // portals don't have methods
								$performScript: fmPortalName ? undefined : _scriptInvoker
							};
							for (var fieldOrPortal = r.firstChild; fieldOrPortal != null; fieldOrPortal = fieldOrPortal.nextSibling) {
								if (fieldOrPortal.tagName == 'FIELD') {
									var fieldName = sanitizeFieldName(fieldOrPortal.attributes['name'].value, fmPortalName);
									var fieldDef = currentSchema[fieldName];
									var assignFn;
									if (!fieldDef) throw {error:'Unknown field ' + fieldName + ', the layout may have been modified since this app was loaded.'};
									if (fieldDef.maxRepeat == 1) {
										assignFn = $parse(fieldName).assign;
									} else {
										var repetition = [], repetitionIndex=0;
										$parse(fieldName).assign(object, repetition);
										assignFn = function (object, value) {
											if (value) {
												repetition[repetitionIndex] = value; // sparse array population
											}
											repetitionIndex++;
										};
									}
									for (var data = fieldOrPortal.firstChild; data != null; data = data.nextSibling) {
										var value = data.textContent;
										switch(fieldDef.result) {
											case 'date':
												value = parseDate(value, schema.dateFormat);
												break;
											case 'timestamp':
												value = parseDate(value, schema.timestampFormat);
												break;
											case 'container':
												value = parseContainer(value);
												break;
										}
										//object[fieldName] = value;
										//$parse(fieldName).assign(object, value);
										assignFn.call(this, object, value);
									}
								} else if (fieldOrPortal.tagName == 'RELATEDSET') {
									fmPortalName = fieldOrPortal.attributes['table'].value;
									var portalName = sanitizeFieldName(fmPortalName);
									object[portalName] = parseRecords(fieldOrPortal, fmPortalName + '::', portalName);
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

				this.layout = function(db, lay) {
					var url = '/fmi/xml/FMPXMLLAYOUT.xml?-view';
					var httpPromise = $http.get(url, {params: {'-db':db,'-lay':lay}});
					return httpPromise.then(function (response) {
						return parseLayoutXml(response);
					});
				}

			}

			return new FMAngular();
		}
	];
});

angular.module('fmangular.ui', []).directive('fmContainer', function ($window) {
	return {
		restrict: 'CE',
		require: 'ngModel',
		template: '<div>' +
				'<a ng-dblclick="openFile()" ng-if="isImage"><img ng-src="{{value.src}}" alt="{{alt || value.filename}}"></a>' +
				'<span ng-if="value && !isImage">{{value.filename}}</span>' +
				'<span ng-if="!value">&nbsp;</span>' +
				'</div>',
		scope: {
			disabled: '@',
			alt: '@',
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
				scope.value = ngModel.$viewValue;
				scope.isImage = scope.value && scope.value.filename && scope.value.filename.match(/\.(gif|png|jpeg|jpg)$/)
			};

			scope.openFile = function() {
				$window.open(scope.value.src, 'Container', {});
			};

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
						var dataUrl = e.target.result;
						ngModel.$setViewValue({src:dataUrl,filename:file.name,type:'jsContainer'});
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
});