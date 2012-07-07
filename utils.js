var fs = require('fs');
var q = require('q');
var pathLib = require('path');

/**
 * Function: readDirRecursive
 * --------------------------
 * Reads the given directory recursively. Promises an array of absolute file
 * paths within the given directory.
 * 
 * @param dir - the directory to read
 * @return promise that yields absolute file paths within the given directory
 */
exports.readDirRecursive = function(dir) {
  var deferred = q.defer();
  var files = [];
  var numProcessed = 0;
  var numPaths;

  q.ncall(fs.readdir, {}, dir)
    .then(function(dirList) {
      numPaths = dirList.length;

      // callback for when one path has been processed
      function pathProcessed() {
        // if done, resolve deferred
        numProcessed++;
        if (numProcessed == numPaths) {
          deferred.resolve(files);
        }
      }

      // go through each file/directory
      dirList.forEach(function(path) {
        q.ncall(fs.stat, fs, path)
          .then(function(stat) {
            var absPath = pathLib.resolve(dir + '/' + path);

            if (stat.isFile()) {
              // if this is a file, add it to the list
              files.push(absPath);
              pathProcessed();
            } else if (stat.isDirectory()) {
              // if this is a dir, recursively read this directory as well
              exports.readDirRecursive(absPath)
                .then(function(dirFiles) {
                  files = files.concat(dirFiles);
                  pathProcessed();
                }).fail(exports.throwError);
            } else {
              pathProcessed();
            }
          }).fail(exports.throwError);
      });
    }).fail(exports.throwError);

    return deferred.promise;
};

/**
 * Function: throwError
 * --------------------
 * Logs the given error to console and then throws it.
 *
 * @param error - the error to throw
 */
exports.throwError = function(error) {
  console.log(error.stack);
  throw error;
};
