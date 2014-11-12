describe('fmangular', function () {

	var fmangular;

	// Load required modules
	beforeEach(angular.mock.module("fmangular"));
	beforeEach(inject(function ($injector) {
		$httpBackend = $injector.get("$httpBackend");
		fmangular = $injector.get('fmangular');
	}));

	afterEach(function () {
		$httpBackend.verifyNoOutstandingExpectation();
		$httpBackend.verifyNoOutstandingRequest();
	});

	describe('find', function () {
		it('issues a -find request', function () {
			$httpBackend.expectGET('/fmi/xml/fmresultset.xml?-find&-db=Tasks&-lay=Tasks&-recid=123').respond('<?xml version ="1.0" encoding="UTF-8" standalone="no" ?><!DOCTYPE FMPXMLRESULT PUBLIC "-//FMI//DTD FMPXMLRESULT//EN" "http://127.0.0.1:16021/fmi/xml/FMPXMLRESULT.dtd"><FMPXMLRESULT xmlns="http://www.filemaker.com/fmpxmlresult"><ERRORCODE>0</ERRORCODE><PRODUCT BUILD="10/29/2014" NAME="FileMaker Web Publishing Engine" VERSION="14.0.1.70"></PRODUCT><DATABASE DATEFORMAT="MM/dd/yyyy" LAYOUT="Tasks" NAME="Tasks" RECORDS="4" TIMEFORMAT="HH:mm:ss"></DATABASE><METADATA><FIELD EMPTYOK="YES" MAXREPEAT="1" NAME="Task" TYPE="TEXT"></FIELD><FIELD EMPTYOK="YES" MAXREPEAT="1" NAME="Status" TYPE="TEXT"></FIELD><FIELD EMPTYOK="YES" MAXREPEAT="11" NAME="Category" TYPE="TEXT"></FIELD><FIELD EMPTYOK="YES" MAXREPEAT="1" NAME="Due Date" TYPE="DATE"></FIELD></METADATA><RESULTSET FOUND="1"><ROW MODID="58" RECORDID="12"><COL><DATA>My second TODO...</DATA></COL><COL><DATA>Completed</DATA></COL><COL><DATA>Business,,,Fourth,,,Fourth,,,Fourth</DATA><DATA></DATA><DATA></DATA><DATA>Fourth</DATA></COL><COL><DATA>10/26/2014</DATA></COL></ROW></RESULTSET></FMPXMLRESULT>', {'content-type':'Content-Type:text/xml;charset=UTF-8'});
			var promise = fmangular.find({'-db': 'Tasks', '-lay': 'Tasks', '-recid': 123});
			$httpBackend.flush();
			expect(promise).toBeDefined()
			promise.then(function () {
				console.log('Got response for promise');
			});

		});
	});

});
