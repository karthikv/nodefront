var utils = require('../lib/utils');
var testUtils = require('./lib/utils');

var nodefront = __dirname + '/../nodefront.js';
var inputDir = __dirname + '/resources/insert/input';
var expectedDir = __dirname + '/resources/insert/expected';

var insert = require('../commands/insert');
var defaultEnv = { tabLength: 4 };

describe('`nodefront insert`', function() {
  it('inserts JavaScript files into HTML footer', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.html',
      defaultEnv, true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.html',
          expectedDir + '/document-js-footer.html');
      })
      .then(done)
      .end();
  });

  it('deletes JavaScript files from HTML footer', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.html',
      utils.extend(defaultEnv, { 'delete': true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.html',
          expectedDir + '/document.html');
      })
      .then(done)
      .end();
  });

  it('inserts JavaScript files into Jade footer', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.jade',
      defaultEnv, true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.jade',
          expectedDir + '/document-js-footer.jade');
      })
      .then(done)
      .end();
  });

  it('deletes JavaScript files from Jade footer', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.jade',
      utils.extend(defaultEnv, { 'delete': true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.jade',
          expectedDir + '/document.jade');
      })
      .then(done)
      .end();
  });

  it('inserts JavaScript files into HTML header', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.html',
      utils.extend(defaultEnv, { head: true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.html',
          expectedDir + '/document-js-header.html');
      })
      .then(done)
      .end();
  });

  it('deletes JavaScript files from HTML header', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.html',
      utils.extend(defaultEnv, { 'delete': true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.html',
          expectedDir + '/document.html');
      })
      .then(done)
      .end();
  });

  it('inserts JavaScript files into Jade header', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.jade',
      utils.extend(defaultEnv, { head: true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.jade',
          expectedDir + '/document-js-header.jade');
      })
      .then(done)
      .end();
  });

  it('deletes JavaScript files from Jade header', function(done) {
    insert(inputDir + '/jquery-1.7.2.js', inputDir + '/document.jade',
      utils.extend(defaultEnv, { 'delete': true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.jade',
          expectedDir + '/document.jade');
      })
      .then(done)
      .end();
  });

  it('inserts CSS files into HTML header', function(done) {
    insert(inputDir + '/bootstrap-2.0.4.css', inputDir + '/document.html',
      defaultEnv, true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.html',
          expectedDir + '/document-css-header.html');
      })
      .then(done)
      .end();
  });

  it('deletes CSS files from HTML header', function(done) {
    insert(inputDir + '/bootstrap-2.0.4.css', inputDir + '/document.html',
      utils.extend(defaultEnv, { 'delete': true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.html',
          expectedDir + '/document.html');
      })
      .then(done)
      .end();
  });

  it('inserts CSS files into Jade header', function(done) {
    insert(inputDir + '/bootstrap-2.0.4.css', inputDir + '/document.jade',
      defaultEnv, true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.jade',
          expectedDir + '/document-css-header.jade');
      })
      .then(done)
      .end();
  });

  it('deletes CSS files from Jade header', function(done) {
    insert(inputDir + '/bootstrap-2.0.4.css', inputDir + '/document.jade',
      utils.extend(defaultEnv, { 'delete': true }), true)
      .then(function() {
        return testUtils.expectFilesToMatch(inputDir + '/document.jade',
          expectedDir + '/document.jade');
      })
      .then(done)
      .end();
  });
});
