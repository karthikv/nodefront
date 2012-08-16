var fs = require('fs');
var q = require('q');
var request = require('request');
var utils = require('../lib/utils');
var testUtils = require('./lib/utils');

var nodefront = __dirname + '/../nodefront.js';
var inputDir = __dirname + '/resources/compile/input';
var expectedDir = __dirname + '/resources/compile/expected';

var compile = require('../commands/compile');
var defaultEnv = {};
var originalDir = process.cwd();

describe('`nodefront compile`', function() {
  before(function() {
    process.chdir(inputDir);
  });

  after(function() {
    process.chdir(originalDir);
  });

  describe('compiles', function() {
    before(function(done) {
      compile(defaultEnv, true)
        .then(function() {
          done();
        })
        .end();
    });

    it('Jade files', function(done) {
      testUtils.expectFilesToMatch(inputDir + '/index.html',
        expectedDir + '/index.html')
        .then(function() {
          return testUtils.expectFilesToMatch(inputDir + '/layout.html',
            expectedDir + '/layout.html');
        })
        .fin(function() {
          try {
            fs.unlinkSync(inputDir + '/index.html');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }

          try {
            fs.unlinkSync(inputDir + '/layout.html');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .then(done)
        .end();
    });

    it('Stylus files', function(done) {
      testUtils.expectFilesToMatch(inputDir + '/style.css',
        expectedDir + '/style.css')
        .fin(function() {
          try {
            fs.unlinkSync(inputDir + '/style.css');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .then(done)
        .end();
    });

    it('Coffee files', function(done) {
      testUtils.expectFilesToMatch(inputDir + '/script.js',
        expectedDir + '/script.js')
        .fin(function() {
          try {
            fs.unlinkSync(inputDir + '/script.js');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .then(done)
        .end();
    });
  });

  describe('serves', function() {
    var port = 3217;

    before(function(done) {
      compile(utils.extend(defaultEnv, { serve: port }), true)
        .then(function() {
          done();
        });
    });

    it('HTML files', function(done) {
      var responseBody;
      q.ncall(request, this, 'http://localhost:' + port + '/index.html')
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/index.html');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
          return q.ncall(request, this, 'http://localhost:' + port +
            '/layout.html');
        })
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/layout.html');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .fin(function() {
          // index.html will be deleted in next test

          try {
            fs.unlinkSync(inputDir + '/layout.html');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .then(done)
        .end();
    });

    it('index.html files when visiting the containing directory',
      function(done) {
        var responseBody;
        q.ncall(request, this, 'http://localhost:' + port + '/')
          .spread(function(response, body) {
            responseBody = body;
            return utils.readFile(inputDir + '/index.html');
          })
          .then(function(expected) {
            responseBody.should.eql(expected);
          })
          .fin(function() {
            try {
              fs.unlinkSync(inputDir + '/index.html');
            } catch (error) {
              // don't worry about this; an error probably occurred above
            }
          })
          .then(done)
          .end();
      });

    it('CSS files', function(done) {
      var responseBody;
      q.ncall(request, this, 'http://localhost:' + port + '/style.css')
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/style.css');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .fin(function() {
          try {
            fs.unlinkSync(inputDir + '/style.css');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .then(done)
        .end();
    });

    it('JS files', function(done) {
      var responseBody;
      q.ncall(request, this, 'http://localhost:' + port + '/script.js')
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/script.js');
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .fin(function() {
          try {
            fs.unlinkSync(inputDir + '/script.js');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .then(done)
        .end();
    });

    it('Image files', function(done) {
      var responseBody;
      q.ncall(request, this, { encoding: null, uri:  'http://localhost:' +
         port + '/images/pattern.jpg' })
        .spread(function(response, body) {
          responseBody = body;
          return utils.readFile(inputDir + '/images/pattern.jpg', true);
        })
        .then(function(expected) {
          responseBody.should.eql(expected);
        })
        .then(done)
        .end();
    });
  });
});
