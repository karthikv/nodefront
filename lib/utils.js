var fs = require('fs');
var q = require('q');
var pathLib = require('path');

/**
 * Function: readDirWithFilter
 * ---------------------------
 * Reads the given directory. Promises an array of absolute file paths within
 * the directory that match the filter regex.
 *
 * @param dir - the directory to read
 * @param recursive - true to read the directory recursively
 * @param rFilter - the regex to filter paths relative to dir with
 * @param filesOnly - true to exclude any paths that are not files
 *
 * @return promise that yields absolute file paths within the given directory
 *  that match the provided filter regex
 */
exports.readDirWithFilter = function(dir, recursive, rFilter, filesOnly) {
  var promise;

  if (recursive) {
    promise = exports.readDirRecursive(dir);
  } else {
    promise = exports.readDirAbsolute(dir);
  }

  promise = promise
    .then(function(files) {
      return files.filter(function(path) {
        var relativePath = pathLib.relative(dir, path);

        // filter relative paths based on the regular expression
        return rFilter.test(relativePath);
      });
    });

  if (filesOnly) {
    promise = promise
      .then(function(dirList) {
        var deferred = q.defer();
        var files = [];
        var numPaths = dirList.length;

        // filter to only files
        dirList.forEach(function(path, index) {
          q.ncall(fs.stat, fs, path)
            .done(function(stat) {
              if (stat.isFile()) {
                files.push(path);
              }

              // done? if so, resolve with the files
              if (index === numPaths - 1) {
                deferred.resolve(files);
              }
            });
        });

        if (numPaths === 0) {
          deferred.resolve([]);
        }

        return deferred.promise;
      });
  }

  return promise;
};

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

  exports.readDirAbsolute(dir)
    .done(function(dirList) {
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
          .done(function(stat) {
            if (stat.isFile()) {
              // if this is a file, add it to the list
              files.push(path);
              pathProcessed();
            } else if (stat.isDirectory()) {
              // if this is a dir, recursively read this directory as well
              exports.readDirRecursive(path)
                .done(function(dirFiles) {
                  files = files.concat(dirFiles);
                  pathProcessed();
                });
            } else {
              pathProcessed();
            }
          });
      });

      if (dirList.length === 0) {
        deferred.resolve([]);
      }
    });

    return deferred.promise;
};

/**
 * Function: readDirAbsolute
 * -------------------------
 * Reads the given directory. Promises an array of absolute file paths within
 * the directory.
 * 
 * @param dir - the directory to read
 * @return promise that yields absolute file paths within the given directory
 */
exports.readDirAbsolute = function(dir) {
  return q.ncall(fs.readdir, {}, dir)
    .then(function(dirList) {
      // map each file/directory to its absolute path
      return dirList.map(function(path) {
        return pathLib.resolve(dir + '/' + path);
      });
    });
};

/**
 * Function: readFile
 * ------------------
 * Reads the given file and promises its contents.
 *
 * @param fileName - the file name to read
 * @param binary - true if this is a binary file
 * @return promise that yields the given file's contents
 */
exports.readFile = function(fileName, binary) {
  if (binary) {
    return q.ncall(fs.readFile, fs, fileName);
  } else {
    return q.ncall(fs.readFile, fs, fileName, 'utf8');
  }
};

/**
 * Function: writeFile
 * -------------------
 * Writes the given contents into the given file. Promises its new contents.
 *
 * @param fileName - the file name to write to
 * @param contents - the contents to write
 */
exports.writeFile = function(fileName, contents) {
  return q.ncall(fs.writeFile, fs, fileName, contents);
};

/**
 * Function: mkdirRecursive
 * ------------------------
 * Make the directories in path recursively, similar to mkdir -p.
 *
 * @param path - the path which represents the directories to create
 * @return promise that yields completion
 */
exports.mkdirRecursive = function(path) {
  var absPath = pathLib.resolve(path);
  var directories = absPath.split('/');

  var directoryPath = '';
  var runningPromise = q.resolve();

  // get rid of empty string at beginning
  directories.shift();

  // make each directory an absolute path
  directories = directories.map(function(directory) {
    directoryPath += '/' + directory;
    return directoryPath;
  });

  var promises = directories.map(function(directory) {
    // return promise that resolves to whether this is an existing directory
    return q.ncall(fs.stat, fs, directory)
      .then(function(stat) {
        if (stat.isFile()) {
          // file exists with the name of a directory that needs to be created
          throw new Error("Directory path cannot be created because a file" +
            "with the name of a target directory");
        }

        return stat.isDirectory();
      }, function() {
        // likely that no such directory exists if the command failed
        return false;
      });
  });

  return q.all(promises)
    .then(function(areDirectories) {
      var promises = areDirectories.map(function(isDirectory, index) {
        // create any directories that don't exist
        if (!isDirectory) {
          return q.ncall(fs.mkdir, fs, directories[index])
            .fail(function(error) {
              // errno 47 means directory already exists, so there is no need
              // to throw any error, as what we're trying to do has been done
              if (error.errno !== 47) {
                throw error;
              }
            });
        }
      });

      return q.all(promises);
    });
};

/**
 * Function: watchFileForModification
 * ----------------------------------
 * Monitors the given file for modifications at the specified interval via
 * polling. Upon alteration, calls callback with two parameters: the current
 * and prior stat of the file, as returned by fs.stat().
 *
 * @param fileName - the name of the file to watch
 * @param interval - the interval to poll for modification
 * @param callback - the callback to call when the file is modified; this will
 *  be passed the current and prior stat of the file, as returned by fs.stat()
 */
exports.watchFileForModification = function(fileName, interval, callback) {
  fs.watchFile(fileName, {
    persistent: true,
    interval: interval
  }, function(curStat, oldStat) {
    // watchFile fires callback on any stat changes; check specifically that
    // the file has been modified
    if (curStat.mtime > oldStat.mtime) {
      callback(curStat, oldStat);
    }
  });
};

/**
 * Function: getExtension
 * ----------------------
 * Returns the extension of the given file name or false if one doesn't exist.
 */
exports.getExtension = function(fileName) {
  var dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1)
    return false;
  return fileName.substring(dotIndex + 1);
};

/**
 * Function: regExpReplace
 * -----------------------
 * Escape plain text for a regular expressions; credit:
 * http://simonwillison.net/2006/Jan/20/escape/#p-6
 *
 * @param text - the plain text to escape
 * @return the escaped text
 */
exports.regExpEscape = function(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

/**
 * Function: qifyProgram
 * ---------------------
 * Given a commander program, add q-style variants of functions that use
 * promises instead of callbacks.
 *
 * @param program - the program to qify
 */
exports.qifyProgram = function(program) {
  /**
   * Function: qifyPromptDialog
   * --------------------------
   * Given a program prompt function (prompt, confirm, etc.), return its qified
   * version, which promises the user's resultant input.
   */
  function qifyPromptDialog(fn) {
    return function(message) {
      var deferred = q.defer();

      fn.call(program, message, function(result) {
        deferred.resolve(result);
      });

      return deferred.promise;
    };
  }

  /**
   * Function: qifyPromptDialogDefault
   * ---------------------------------
   * Given a program prompt function (prompt, confirm, etc.), return its qified
   * version with an added default value, which promises the user's resultant
   * input or, if nothing is entered, the given default.
   */
  function qifyPromptDialogWithDefault(fn) {
    return function(message, defaultValue) {
      message = message.trim();
      if (defaultValue) {
        message = message + ' (leave blank for ' + defaultValue + ')';
      }
      message += ': ';

      return qifyPromptDialog(fn)(message)
        .then(function(result) {
          if (result) {
            return result;
          } else {
            return defaultValue;
          }
        });
    };
  }

  program.qPrompt = qifyPromptDialog(program.prompt);
  program.qPassword = qifyPromptDialog(program.password);
  program.qConfirm = qifyPromptDialog(program.confirm);
  program.qChoose = qifyPromptDialog(program.choose);

  program.qPromptDefault = qifyPromptDialogWithDefault(program.prompt);
  program.qPasswordDefault = qifyPromptDialogWithDefault(program.password);
  program.qConfirmDefault = qifyPromptDialogWithDefault(program.confirm);
  program.qChooseDefault = qifyPromptDialogWithDefault(program.choose);
};

/**
 * Function: extend
 * ----------------
 * Extends the given destination object with the source object, overriding
 * properties in destination if they are also present in source.
 *
 * @param destination - the destination object to extend
 * @param source - the source object to extend the destination with
 * @param shouldModify - whether to modify the destination; defaults to false
 *
 * @return the extended object
 */
exports.extend = function(destination, source, shouldModify) {
  if (!shouldModify) {
    // extend a blank object to get a clone
    var destinationClone = exports.extend({}, destination, true);
    return exports.extend(destinationClone, source, true);
  }

  // define properties in destination one-by-one from source
  var properties = Object.getOwnPropertyNames(source);
  properties.forEach(function(name) {
    var descriptor = Object.getOwnPropertyDescriptor(source, name);
    Object.defineProperty(destination, name, descriptor);
  });

  return destination;
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
