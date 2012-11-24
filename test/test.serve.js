var q = require('q');
var request = require('request');
var sandboxedModule = require('sandboxed-module');
var should = require('should');
var Zombie = require('zombie');

var utils = require('../lib/utils');
var testUtils = require('./lib/utils');

var compileCalled = false;
var compileMock = function(env) {
  compileCalled = true;

  if (!env.recursive) {
    throw new Error('recursive option not provided');
  } else if (!env.watch) {
    throw new Error('watch option not provided');
  } else if (!env.output) {
    throw new Error('output option not provided');
  }
  
  return q.resolve();
};

var inputDir = __dirname + '/resources/serve/input';
var serve = sandboxedModule.require('../commands/serve', {
  requires: {
    './compile': compileMock,
    '../lib/utils': testUtils.mockUtilsModifications()
  }
});

var defaultEnv = {
  output: '.'
};
var originalDir = process.cwd();

describe('`nodefront serve`', function() {
  before(function() {
    process.chdir(inputDir);
  });

  after(function() {
    process.chdir(originalDir);
  });

  /**
   * Function: confirmFilesAreServed
   * -------------------------------
   * Creates tests to confirm that HTML, CSS, JS, and binary files are
   * correctly served at the given hostname and port.
   *
   * @param port - the port where files are served
   * @param hostname - the hostname where files are served
   */
  function confirmFilesAreServed(port, hostname) {
    it('HTML files', function(done) {
      var responseBody;
      q.ncall(request, this, 'http://' + hostname + ':' + port + '/index.html')
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/index.html');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
          return q.ncall(request, this, 'http://' + hostname + ':' + port +
            '/layout.html');
        })
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/layout.html');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .done(done);
    });

    it('index.html files when visiting the containing directory',
      function(done) {
        var responseBody;
        q.ncall(request, this, 'http://' + hostname + ':' + port + '/')
          .spread(function(response, body) {
            responseBody = body;
            return utils.readFile(inputDir + '/index.html');
          })
          .then(function(expected) {
            responseBody.should.eql(expected);
          })
          .done(done);
      });

    it('CSS files', function(done) {
      var responseBody;
      q.ncall(request, this, 'http://' + hostname + ':' + port + '/style.css')
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/style.css');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .done(done);
    });

    it('JS files', function(done) {
      var responseBody;
      q.ncall(request, this, 'http://' + hostname + ':' + port + '/script.js')
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/script.js');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .done(done);
    });

    it('Image files', function(done) {
      var responseBody;
      q.ncall(request, this, { encoding: null, uri:  'http://' + hostname +
        ':' + port + '/images/pattern.jpg' })
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/images/pattern.jpg', true);
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .done(done);
    });
  }

  var defaultPort = 3000;
  var defaultHostname = '127.0.0.1';

  describe('serves on default hostname and default port', function() {
    before(function(done) {
      serve(undefined, undefined, defaultEnv, true)
        .done(done);
    });

    confirmFilesAreServed(defaultPort, defaultHostname);
  });

  var customPort = 3217;
  describe('serves on default hostname and custom port', function() {
    before(function(done) {
      serve(customPort, undefined, defaultEnv, true)
        .done(done);
    });

    confirmFilesAreServed(customPort, defaultHostname);

    after(function() {
      serve.server.close();
    });
  });

  it('runs compile -wr -o <directory>', function(done) {
    // error will be thrown by compile mock if an issue arises
    serve(customPort, undefined, utils.extend(defaultEnv, { compile: true }),
      true)
      .done(function() {
        compileCalled.should.equal(true);
        serve.server.close();
        done();
      });
  });

  describe('updates the browser', function() {
    var browser;

    var pageToVisit = '/layout.html';
    var expectedPageTitle = 'Layout';

    before(function() {
      browser = new Zombie();
    });

    beforeEach(function(done) {
      serve(customPort, undefined, utils.extend(defaultEnv, { live: true }),
        true)
        .then(function() {
          return browser.visit('http://' + defaultHostname + ':' + customPort +
            pageToVisit);
        })
        .done(function() {
          browser.success.should.equal(true);
          browser.success = false;

          // set the title to some bogus value
          browser.evaluate("document.title = 'not refreshed';");

          // wait for socket.io to kick in before finishing
          setTimeout(done, 50);
        });
    });

    afterEach(function() {
      utils.removeMockModificationListeners();
      serve.server.close();
    });

    /**
     * Function: confirmBrowserRefresh
     * -------------------------------
     * Confirms that the browser was refreshed.
     *
     * @param done - callback to be called when finished
     */
    function confirmBrowserRefresh(done) {
      // wait for changes to propagate
      setTimeout(function() {
        // if the browser was indeed refreshed, the title should revert back to
        // its normal value
        var title = browser.evaluate("document.title");
        title.should.equal(expectedPageTitle);
        done();
      }, 50);
    }

    it('when an HTML file is modified', function(done) {
      // file modification should result in refresh
      utils.mockFileModification(inputDir + '/layout.html');
      confirmBrowserRefresh(done);
    });

    it('when a CSS file is modified', function(done) {
      var linkHref = browser.query('link').getAttribute('href');
      // file modification should result in cache-busting query string
      utils.mockFileModification(inputDir + '/style.css');

      setTimeout(function() {
        // was link successfully cache-busted?
        var newLinkHref = browser.query('link').getAttribute('href');
        newLinkHref.should.not.equal(linkHref);

        linkHref.indexOf('?').should.equal(-1);
        newLinkHref.indexOf('?').should.not.equal(-1);
        done();
      }, 50);
    });

    it('when a JS file is modified', function(done) {
      // file modification should result in refresh
      utils.mockFileModification(inputDir + '/script.js');
      confirmBrowserRefresh(done);
      pageToVisit = '/'; // for next test
    });

    it('when an index.html file is modified', function(done) {
      utils.mockFileModification(inputDir + '/index.html');
      expectedPageTitle = '';
      confirmBrowserRefresh(done);
    });
  });
});
