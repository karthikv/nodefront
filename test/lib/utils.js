var fs = require('fs');
var should = require('should');
var utils = require('../../lib/utils');
var q = require('q');

/**
 * Function: expectFilesToMatch
 * ----------------------------
 * Expects the contents of the two given files to match.
 *
 * @param expectedFileName - the file with the expected contents
 * @param actualFileName - the file with the actual contents
 * 
 * @return promise that yields success if the contents match or an error
 *  otherwise
 */
exports.expectFilesToMatch = function(expectedFileName, actualFileName) {
  var expected = utils.readFile(expectedFileName);
  var actual = utils.readFile(actualFileName);

  return exports.expectResultsToMatch(expected, actual);
};

/**
 * Function: expectResultsToMatch
 * ------------------------------
 * Expects the results of the two given promises to match.
 *
 * @param expected - an expected string or promise for a string
 * @param actual - an actual string or promise for a string
 * 
 * @return promise that yields success if the results match or an error
 *  otherwise
 */
exports.expectResultsToMatch = function(expected, actual) {
  return q.all([expected, actual])
    .spread(function(expected, actual) {
      // make line-endings consistent
      actual = actual.replace(/\r\n/g, '\n');
      expected = expected.replace(/\r\n/g, '\n');

      actual.should.equal(expected);
    });
};

/**
 * Function: mockUtilsModification
 * -------------------------------
 * Mocks the watchFileForModification function in the utils module. Adds a
 * mockFileModication function to utils that immediately triggers a given
 * file's modification callback.
 *
 * @return the mocked utils module
 */
exports.mockUtilsModifications = function() {
  var utils = require('../../lib/utils');
  var events = require('events');
  var emitter = new events.EventEmitter();

  utils.watchFileForModification = function(fileName, interval, callback) {
    emitter.on('mockModification', function(fileModified) {
      if (fileModified === fileName) {
        // make sure the modification time of the current stat is greater than
        // the modification time of the old stat when triggering the callback
        callback({ mtime: 10 }, { mtime: 9 });
      }
    });
  };

  /**
   * Function: mockFileModification
   * ------------------------------
   * Immediately triggers the modification callback for the given file.
   *
   * @param fileName - the file to trigger a modification callback for
   */
  utils.mockFileModification = function(fileName) {
    emitter.emit('mockModification', fileName);
  };

  /**
   * Function: removeMockModificationListeners
   * -----------------------------------------
   * Removes any EventEmitter listeners associated with mocked modifications
   * thus far. Doesn't stop future mocked modifications.
   */
  utils.removeMockModificationListeners = function() {
    emitter.removeAllListeners();
  };

  return utils;
};
