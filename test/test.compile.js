var fs = require('fs');
var q = require('q');
var request = require('request');
var utils = require('../lib/utils');
var testUtils = require('./lib/utils');

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
});
