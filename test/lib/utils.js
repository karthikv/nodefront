var fs = require('fs');
var should = require('should');
var utils = require('../../lib/utils');

/**
 * Function: expectFilesToMatch
 * ----------------------------
 * Expects the contents of the two given files to match.
 *
 * @param fileNameA - the first file
 * @param fileNameB - the second file
 * 
 * @return promise that yields success if the contents match or an error
 *  otherwise
 */
exports.expectFilesToMatch = function(fileNameA, fileNameB) {
  var expected;
  return utils.readFile(fileNameA)
    .then(function(contents) {
      expected = contents;
      return utils.readFile(fileNameB);
    })
    .then(function(contents) {
      try {
        contents.should.eql(expected);
      } catch (error) {
        // don't print out contents and expected because they are too large
        throw new Error("Contents don't match expected.");
      }
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
