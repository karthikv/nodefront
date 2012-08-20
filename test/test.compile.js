var fs = require('fs');
var q = require('q');
var request = require('request');
var sandboxedModule = require('sandboxed-module');

var utils = require('../lib/utils');
var testUtils = require('./lib/utils');

var inputDir = __dirname + '/resources/compile/input';
var expectedDir = __dirname + '/resources/compile/expected';

var compile = sandboxedModule.require('../commands/compile', {
  requires: {
    '../lib/utils': testUtils.mockUtilsModifications()
  }
});

var defaultEnv = {};
var originalDir = process.cwd();

describe('`nodefront compile`', function() {
  before(function() {
    process.chdir(inputDir);
  });

  after(function() {
    process.chdir(originalDir);
  });

  /**
   * Function: confirmFilesAreCompiled
   * ---------------------------------
   * Creates tests to confirm that Jade, Stylus, and CoffeeScript files
   * were compiled successfully to HTML, CSS, and JS, respectively.
   */
  function confirmFilesAreCompiled() {
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
  }

  describe('compiles', function() {
    before(function(done) {
      compile(defaultEnv, true)
        .then(function() {
          done();
        })
        .end();
    });

    confirmFilesAreCompiled();
  });

  describe('watches', function() {
    before(function(done) {
      compile(utils.extend(defaultEnv, { watch: true }), true)
        .then(function() {
          var unlink = q.nbind(fs.unlink, fs);

          // get rid of initially compiled files, as this is testing watch
          // functionality
          return q.all([
            unlink(inputDir + '/index.html'),
            unlink(inputDir + '/layout.html'),
            unlink(inputDir + '/style.css'),
            unlink(inputDir + '/script.js')
          ]);
        })
        .then(function() {
          // mock modifications of all files that need to be compiled
          utils.mockFileModification(inputDir + '/index.jade');
          utils.mockFileModification(inputDir + '/layout.jade');
          utils.mockFileModification(inputDir + '/style.styl');
          utils.mockFileModification(inputDir + '/script.coffee');

          // wait for compilation to finish
          setTimeout(done, 50);
        })
        .end();
    });

    // confirm compilation actually happens
    confirmFilesAreCompiled();

    after(function() {
      utils.removeMockModificationListeners();
    });
  });
});
