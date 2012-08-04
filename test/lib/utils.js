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
