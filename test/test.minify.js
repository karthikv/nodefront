var fs = require('fs');
var q = require('q');
var utils = require('../lib/utils');
var testUtils = require('./lib/utils');
var sandboxedModule = require('sandboxed-module');

var inputDir = __dirname + '/resources/minify/input';
var expectedDir = __dirname + '/resources/minify/expected';

// mock out UglifyJS minification to quicken this test
var uglifyJSMock = {
  parser: {
    parse: function() {
      return 'parsed';
    }
  },

  uglify: {
    ast_mangle: function(ast) {
      if (ast === 'parsed') {
        return 'mangled';
      } else {
        // must be called after parse
        throw new Error('UglifyJS ast_mangle not called in order');
      }
    },

    ast_squeeze: function(ast) {
      if (ast === 'mangled') {
        return 'squeezed';
      } else {
        // must be called after ast_mangle
        throw new Error('UglifyJS ast_squeeze not called in order');
      }
    },

    gen_code: function(ast) {
      if (ast === 'squeezed') {
        return this.minifiedCode;
      } else {
        // must be called after ast_squeeze
        throw new Error('UglifyJS gen_code not called in order');
      }
    },

    // set the expected minified code to be returned
    setMinifiedCode: function(minifiedCode) {
      this.minifiedCode = minifiedCode;
    }
  }
};

var cssminMock = {
  minify: function() {
    return this.minifiedCode;
  },

  setMinifiedCode: function(minifiedCode) {
    this.minifiedCode = minifiedCode;
  }
};

var minify = sandboxedModule.require('../commands/minify', {
  requires: {
    'uglify-js': uglifyJSMock,
    '../lib/cssmin': cssminMock
  }
});
var defaultEnv = { out: '{{ name }}.min.{{ extension }}' };
var originalDir = process.cwd();

describe('`nodefront minify`', function() {
  before(function() {
    process.chdir(inputDir);
  });

  after(function() {
    process.chdir(originalDir);
  });

  it('minfies javascript files', function(done) {
    utils.readFile(expectedDir + '/script.min.js')
      .then(function(contents) {
        uglifyJSMock.uglify.setMinifiedCode(contents);
        return minify('script.js$', defaultEnv, true);
      })
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/script.min.js',
          expectedDir + '/script.min.js');
      })
      .fin(function() {
        return q.ncall(fs.unlink, fs, inputDir + '/script.min.js');
      })
      .done(done);
  });

  it('minifies css files', function(done) {
    utils.readFile(expectedDir + '/style.min.css')
      .then(function(contents) {
        cssminMock.setMinifiedCode(contents);
        return minify('style.css$', defaultEnv, true);
      })
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/style.min.css',
          expectedDir + '/style.min.css');
      })
      .fin(function() {
        return q.ncall(fs.unlink, fs, inputDir + '/style.min.css');
      })
      .done(done);
  });

  it('optimizes JPG images', function(done) {
    minify('images/rectangle.jpg$', defaultEnv, true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/images/rectangle.min.jpg',
          expectedDir + '/images/rectangle.min.jpg');
      })
      .fin(function() {
        try {
          fs.unlinkSync(inputDir + '/images/rectangle.min.jpg');
        } catch (error) {
          // don't worry about this; there was likely an error earlier
        }
      })
      .done(done);
  });

  it('optimizes PNG images', function(done) {
    minify('images/placeholder.png', defaultEnv, true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/images/placeholder.min.png',
          expectedDir + '/images/placeholder.min.png');
      })
      .fin(function() {
        try {
          fs.unlinkSync(inputDir + '/images/placeholder.min.png');
        } catch (error) {
          // don't worry about this; there was likely an error earlier
        }
      })
      .done(done);
  });
});
