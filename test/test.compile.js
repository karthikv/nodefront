var fs = require('fs');
var q = require('q');
var request = require('request');
var sandboxedModule = require('sandboxed-module');
var config = require('commander-config');

var utils = require('../lib/utils');
var testUtils = require('./lib/utils');

var inputDir = __dirname + '/resources/compile/input';
var expectedDir = __dirname + '/resources/compile/expected';

var inputDirWithoutOptions = inputDir + '/without-options';
var inputDirWithOptions = inputDir + '/with-options';
var outputDir = inputDir + '/compile-output';

var expectedDirWithoutOptions = expectedDir + '/without-options';
var expectedDirWithOptions = expectedDir + '/with-options';

var compile = sandboxedModule.require('../commands/compile', {
  requires: {
    '../lib/utils': testUtils.mockUtilsModifications()
  }
});

var defaultEnv = { output: '.' };
var originalDir = process.cwd();

describe('`nodefront compile`', function() {
  before(function() {
    process.chdir(inputDirWithoutOptions);
  });

  after(function() {
    process.chdir(originalDir);
  });

  /**
   * Function: confirmFilesAreCompiled
   * ---------------------------------
   * Creates tests to confirm that Jade, Stylus, and CoffeeScript files
   * are compiled successfully to HTML, CSS, and JS, respectively.
   *
   * @param inputFilesDir -- the directory to find input files in
   * @param expectedFilesDir -- the directory to find expected, compiled files
   *  for comparsion
   */
  function confirmFilesAreCompiled(inputFilesDir, expectedFilesDir) {
    it('Jade files', function(done) {
      testUtils.expectFilesToMatch(inputFilesDir + '/index.html',
        expectedFilesDir + '/index.html')
        .then(function() {
          return testUtils.expectFilesToMatch(inputFilesDir + '/layout.html',
            expectedFilesDir + '/layout.html');
        })
        .fin(function() {
          try {
            fs.unlinkSync(inputFilesDir + '/index.html');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }

          try {
            fs.unlinkSync(inputFilesDir + '/layout.html');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .done(done);
    });

    it('Stylus files', function(done) {
      testUtils.expectFilesToMatch(inputFilesDir + '/style.css',
        expectedFilesDir + '/style.css')
        .fin(function() {
          try {
            fs.unlinkSync(inputFilesDir + '/style.css');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .done(done);
    });

    it('Coffee files', function(done) {
      testUtils.expectFilesToMatch(inputFilesDir + '/script.js',
        expectedFilesDir + '/script.js')
        .fin(function() {
          try {
            fs.unlinkSync(inputFilesDir + '/script.js');
          } catch (error) {
            // don't worry about this; an error probably occurred above
          }
        })
        .done(done);
    });
  }

  describe('compiles', function() {
    before(function(done) {
      compile(defaultEnv, true)
        .done(function() {
          done();
        });
    });

    confirmFilesAreCompiled(inputDirWithoutOptions, expectedDirWithoutOptions);
  });

  describe(', given explicit output directory, compiles', function() {
    before(function(done) {
      compile(utils.extend(defaultEnv, { output: outputDir }), true)
        .done(function() {
          done();
        });
    });

    confirmFilesAreCompiled(outputDir, expectedDirWithoutOptions);
  });

  describe('watches', function() {
    before(function(done) {
      compile(utils.extend(defaultEnv, { watch: true }), true)
        .then(function() {
          var unlink = q.nbind(fs.unlink, fs);

          // get rid of initially compiled files, as this is testing watch
          // functionality
          return q.all([
            unlink(inputDirWithoutOptions + '/index.html'),
            unlink(inputDirWithoutOptions + '/layout.html'),
            unlink(inputDirWithoutOptions + '/style.css'),
            unlink(inputDirWithoutOptions + '/script.js')
          ]);
        })
        .done(function() {
          // mock modifications of all files that need to be compiled
          utils.mockFileModification(inputDirWithoutOptions + '/index.jade');
          utils.mockFileModification(inputDirWithoutOptions + '/layout.jade');
          utils.mockFileModification(inputDirWithoutOptions + '/style.styl');
          utils.mockFileModification(inputDirWithoutOptions +
            '/script.coffee');

          // wait for compilation to finish
          setTimeout(done, 100);
        });
    });

    // confirm compilation actually happens
    confirmFilesAreCompiled(inputDirWithoutOptions, expectedDirWithoutOptions);

    after(function() {
      utils.removeMockModificationListeners();
    });
  });

  describe('recognizes compiler options for', function() {
    before(function(done) {
      process.chdir(inputDirWithOptions);

      config.withSettings('.nf/compile', function(env) {
        compile(env, true)
          .done(function() {
            done();
          });
      })(defaultEnv);
    });

    after(function() {
      process.chdir(inputDirWithoutOptions);
    });

    confirmFilesAreCompiled(inputDirWithOptions, expectedDirWithOptions);
  });
});
