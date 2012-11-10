var fs = require('fs');
var urlLib = require('url');
var q = require('q');
var should = require('should');
var utils = require('../lib/utils');
var testUtils = require('./lib/utils');
var libraries = require('../libraries.json');
var sandboxedModule = require('sandboxed-module');

var outputDir = __dirname + '/resources/fetch/output';
var expectedDir = __dirname + '/resources/fetch/expected';

// mock out UglifyJS minification to quicken this test
var uglifyJSMock = {
  parser: {
    parse: function() {}
  },

  uglify: {
    ast_mangle: function(ast) {},
    ast_squeeze: function(ast) {},

    gen_code: function(ast) {
      return this.minifiedCode;
    },

    // set the expected minified code to be returned
    setMinifiedCode: function(minifiedCode) {
      this.minifiedCode = minifiedCode;
    }
  }
};

// mock out HTTP requests
var mockResponses = {};
var requestMock = function(url, callback) {
  if (callback) {
    // call callback with mock response
    callback(null, { statusCode: 200 }, mockResponses[url]);
  } else {
    // return mock stream with mock response
    return {
      on: function(event, callback) {
        // only track end callback
        if (event === 'end') {
          this.endCallback = callback;
        }
      },

      pipe: function(stream) {
        var self = this;

        // immediately write to stream
        stream.end(mockResponses[url]);
        stream.on('close', function() {
          self.endCallback();
        });
      }
    };
  }
};

var fetch = sandboxedModule.require('../commands/fetch', {
  requires: {
    './minify': sandboxedModule.require('../commands/minify', {
      requires: {
        'uglify-js': uglifyJSMock
      }
    }),
    request: requestMock
  }
});
var defaultEnv = { version: '', output: outputDir, type: 'js' };

describe('`nodefront fetch`', function() {
  testFetch('jquery', '1.7.2');
  testFetch('dojo', '1.7.3');
  testFetch('ext-core', '3.1.0');

  it('fetches given a URL', function(done) {
    var libraryName = 'example-lib';
    var version = '1.1.9';

    var fileName = libraryName + '-' + version + '.js';
    // example URL to fetch from; will be mocked
    var url = 'http://example.org/example/path';
    var expected;

    libraries[libraryName] = { url: url, latest: version };
    readExpectedLibraryFile(libraryName, version)
      .then(function(contents) {
        expected = contents;

        mockLibraryURL(libraryName, expected);
        return fetch(libraryName, utils.extend(defaultEnv,
          { url: url, version: version }), true, true);
      })
      .then(function() {
        return confirmFetch(libraryName, expected, version);
      })
      .fin(function() {
        // clean up libraries array
        delete libraries[libraryName];
      })
      .done(done);
  });

  it('minifies upon download', function(done) {
    var libraryName = 'mootools';
    var version = '1.4.5';
    var expected;

    readExpectedLibraryFile(libraryName, version)
      .then(function(contents) {
        expected = contents;

        // read the unminified file, which should be the mocked response to the
        // library URL
        return utils.readFile(expectedDir + '/' + libraryName + '-' + version +
          '-unminified.js');
      })
      .then(function(contents) {
        mockLibraryURL(libraryName, contents, version);
        uglifyJSMock.uglify.setMinifiedCode(expected);

        return fetch(libraryName, utils.extend(defaultEnv,
          { version: version, minify: true }), true, true);
      })
      .then(function() {
        return confirmFetch(libraryName, expected, version);
      })
      .done(done);
  });

  it('fetches given a zip file and path', function(done) {
    var libraryName = 'example-zip-lib';
    var version = '2.3.2';

    var zipFileName = libraryName + '-' + version + '.zip';
    var extension = 'css';

    var fileName = libraryName + '-' + version + '.' + extension;
    // example URL to fetch from; will be mocked
    var url = 'https://nodeload.github.com/karthikv/dotfiles/zipball/master';
    var path = utils.regExpEscape('bootstrap.css') + '$';
    var expected;

    libraries[libraryName] = { type: extension, url: url, latest: version };
    readExpectedLibraryFile(libraryName, version)
      .then(function(contents) {
        expected = contents;
        return utils.readFile(expectedDir + '/' + zipFileName, true);
      })
      .then(function(contents) {
        mockLibraryURL(libraryName, contents);
        return fetch(libraryName, utils.extend(defaultEnv,
          { type: extension, url: url, version: version, path: path }), true,
          true);
      })
      .then(function() {
        return confirmFetch(libraryName, expected, version);
      })
      .fin(function() {
        // clean up libraries array
        delete libraries[libraryName];
      })
      .done(done);
  });

  /**
   * Function: testFetch
   * -------------------
   * Creates a test to see whether nodefront can fetch the given library at the
   * given version.
   *
   * @param libraryName - the name of the library to fetch
   * @param version - the version to fetch the library at
   */
  function testFetch(libraryName, version) {
    it('fetches ' + libraryName + ' ' + version, function(done) {
      var expected;

      readExpectedLibraryFile(libraryName, version)
        .then(function(contents) {
          expected = contents;

          // mock the library URL with the expected response for a fast test
          mockLibraryURL(libraryName, expected, version);

          // get the libraryName via nodefront fetch
          return fetch(libraryName, utils.extend(defaultEnv,
            { version: version }), true, true);
        })
        .then(function() {
          return confirmFetch(libraryName, expected, version);
        })
        .done(done);
    });
  }

  /**
   * Function: readExpectedLibraryFile
   * ---------------------------------
   * Given a library's name and version, promise its expected contents.
   *
   * @param libraryName - the library's name
   * @param version - the library's version
   *
   * @return promise that yields the expected contents of the library read from
   *  the expected directory.
   */
  function readExpectedLibraryFile(libraryName, version) {
    var library = libraries[libraryName];
    var extension = library.type || 'js';

    var fileName = libraryName + '-' + version + '.' + extension;
    return utils.readFile(expectedDir + '/' + fileName);
  }

  /**
   * Function: mockLibraryURL
   * ------------------------
   * Given a library name, mock its url to return the given response.
   *
   * @param libraryName - the library name
   * @param response - the contents to respond to the library's URL with
   * @param version - the version of the library; defaults to the latest
   *  version
   */
  function mockLibraryURL(libraryName, response, version) {
    var library = libraries[libraryName];
    var url = library.url
      .replace(/\{\{\s*version\s*\}\}/, version || library.latest);
    mockResponses[url] = response;
  }

  /**
   * Function: confirmFetch
   * ----------------------
   * Confirms that fetching a library was successful, given its name and
   * expected content.
   *
   * @param libraryName - the name of the library to check for
   * @param expected - the expected contents
   * @param version - the version of the library; defaults to the latest
   *  version
   *
   * @return promise that yields completion or error upon invalid fetch
   */
  function confirmFetch(libraryName, expected, version) {
    var library = libraries[libraryName];
    var extension = library.type || 'js';

    version = version || library.latest;
    var fileName = libraryName + '-' + version + '.' + extension;
    var actual = utils.readFile(outputDir + '/' + fileName);

    return testUtils.expectResultsToMatch(expected, actual)
      .then(function() {
        return q.ncall(fs.unlink, fs, outputDir + '/' + fileName);
      });
  }
});
