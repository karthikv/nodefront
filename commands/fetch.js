var fs = require('fs');
var pathLib = require('path');
var request = require('request');
var libraries = require('nconf');
var q = require('q');
var program = require('commander');
var JSZip = require('node-zip');
var minifyCommand = require('./minify');
var utils = require('../lib/utils');

// add promise variants of program functions using q
utils.qifyProgram(program);

// json configuration file for standard libraries
libraries.file({ file: __dirname + '/../libraries.json' });

/**
 * Node Module Export
 * ------------------
 * Exports the fetch command for nodefront. This fetches libraries from the
 * web and adds them to the user's project.
 *
 * @param libraryName - the name of the library to fetch
 * @param env - the command-live environment
 *  If the -u/--url <url> parameter is specified, the library is fetched from
 *  the given <url>.
 *
 *  If the -p/--path <path> parameter is specified, the -u/--url <url>
 *  parameter must also be specified. This assumes that <url> points to a zip
 *  archive. <path> is a regular expression then references the path to the
 *  library file, relative to the zip file root, that should be extracted.
 *  If <path> is ambiguous, the first matching path will be chosen.
 *
 *  If the -v/--version <version> parameter is specified, the library at the
 *  version <version> will be fetched.
 *
 *  If the -o/--output <directory> parameter is specified, the library will be
 *  added to <directory>. Otherwise, it will be added to the current directory.
 *
 *  If the -t/--type <type> parameter is specified, the extension of the
 *  library will be <type>. Note that the format of the library file name will
 *  be <libraryName>-<version>.<type>. Defaults to js.
 *
 * @param omitSave - if true, omit saving the configuration for this library
 * @param shouldPromise - if true, returns a promise that yields completion
 */
module.exports = exports = function(libraryName, env, omitSave,
    shouldPromise) {
  if (env.interactive) {
    runInteractiveSession(libraryName, env);

    // runInteractiveSession will call this function again without interactive
    // mode enabled and with the interactive inputs
    return;
  }

  var url = env.url;
  var path = env.path;
  var version = env.version;
  var latest = env.latest;
  var type = env.type;
  var minify = env.minify;

  // normalize library names to lowercase
  libraryName = libraryName.toLowerCase();

  if (!url) {
    // find library information in the libraries file
    var library = libraries.get(libraryName);
    if (!library) {
      console.error('Could not find library ' + libraryName + '. Please' +
                    ' specify a URL via the -u/--url parameter or jump into' +
                    ' the interactive mode with -i/--interactive.');
      return;
    }

    url = library.url;
    path = library.path;
    type = library.type || 'js';

    if (!version) {
      // if no version was specified, assume the user wants the latest
      version = library.latest;
    }
    if (!minify) {
      minify = library.minify;
    }
  } else {
    // if library information is given, save it for future use
    libraries.set(libraryName, {
      type: type,
      url: url,
      path: path,
      latest: latest || version,
      minify: minify
    });
    
    if (!omitSave) {
      libraries.save(function(err) {
        if (err) {
          console.error('Could not save the library configuration to disk.');
        }
      });
    }
  }

  url = url.replace(/\{\{\s*version\s*\}\}/, version);
  var fileName;

  if (version) {
    fileName = libraryName + '-' + version + '.' + type;
  } else {
    fileName = libraryName + '.' + type;
  }

  var dirName = env.output;
  var promise;

  if (url && path) {
    // download the zip archive to a temporary file
    var toFileName = 'nodefront-' + libraryName + '-tmp';

    promise = downloadFile(url, toFileName)
      .then(function() {
        return utils.readFile(toFileName, true);
      })
      .then(function(buffer) {
        var pathRegex = new RegExp(path);
        var zip = new JSZip(buffer.toString('base64'), { base64: true });

        var files = zip.filter(function(path, file) {
          return !file.options.dir && pathRegex.test(path);
        });

        if (files.length === 0) {
          console.error('The path you specified could not be found.');
        } else {
          outputFileData(files[0].data, libraryName, fileName, dirName);

          if (minify) {
            return minifyFetchedFile(dirName, fileName);
          }
        }
      })
      .fin(function() {
        // delete the temporary file
        fs.unlinkSync(toFileName);
      });
  } else if (url) {
    // download the file at the URL and output it
    promise = downloadFile(url)
      .then(function(data) {
        var originalDir;
        outputFileData(data, libraryName, fileName, dirName);

        if (minify) {
          return minifyFetchedFile(dirName, fileName);
        }
      });
  }

  if (shouldPromise) {
    return promise;
  } else {
    promise.done();
  }
};

/**
 * Function: runInteractiveSession
 * -------------------------------
 * Runs an interactive session to fetch a library, querying the user for
 * a name, URL, path, etc.
 *
 * @param libraryName - the name of the library or undefined if not provided
 * @param env - the command-line environment
 */
function runInteractiveSession(libraryName, env) {
  console.log('To begin, please enter the name of the library you would\n' +
              'like to fetch. You will use this name to access the\n' +
              'library in the future and it will also be used to name the\n' +
              'fetched file.\n');

  program.qPromptDefault('Library name', libraryName)
    .then(function(name) {
      libraryName = name;

      console.log('\nWhat URL can this library be accessed at? You may\n' +
                  'specify either a direct link or a link to a zip file\n' +
                  'containing the library you are looking for.\n');
      console.log('For added flexibility in your library choice, you may\n' +
                  'include {{ version }} in your URL. This will be\n' +
                  'replaced by the version number being requested via\n' +
                  'the -v/--version parameter. This implies that you\n' +
                  'must find a flexible URL. If you cannot, that\'s fine;\n' +
                  'this feature is completely optional.\n');

      return program.qPromptDefault('URL', env.url);
    })
    .then(function(url) {
      env.url = url;

      console.log("\nWhat type of library is this (enter 'css' for CSS and\n" +
                  "'js'for JavaScript).\n");
      return program.qPromptDefault('Library type', env.type);
    })
    .then(function(type) {
      env.type = type;

      console.log('\nPlease enter in the latest version of this library:\n');
      return program.qPromptDefault('Latest version', env.latest ||
        env.version);
    })
    .then(function(latest) {
      env.latest = latest;

      console.log('\nIf you would like to fetch a version different from\n' +
                  'the one you just entered, please enter that here:\n');
      return program.qPromptDefault('Version', env.version || env.latest);
    })
    .then(function(version) {
      env.version = version;

      console.log('\nDoes the URL you entered earlier point to a zip\n' +
                  'archive?');
      return program.qConfirm('\nZip archive? ');
    })
    .then(function(isZip) {
      if (isZip) {
        var url = env.url.replace(/\{\{\s*version\s*\}\}/, env.version);
        console.log('\nYou will now need to select which file in the zip\n' +
                    'archive is the library you are looking for. Please\n' +
                    'choose from the list below.\n');

        var toFileName = 'nodefront-' + libraryName + '-zip';
        return downloadFile(url, toFileName)
          .then(function(toFileName) {
            return utils.readFile(toFileName, true);
          })
          .then(function(buffer) {
            var zip = new JSZip(buffer.toString('base64'), { base64: true });
            var files = zip.filter(function(path, file) {
              return !file.options.dir;
            });

            fs.unlinkSync(toFileName);
            // map files to just name
            return files.map(function(file) {
              return file.name;
            });
          })
          .then(function(entries) {
            return program.qChoose(entries)
              .then(function(index) {
                return entries[index];
              });
          });
      }
    })
    .then(function(path) {
      if (path) {
        // first part of the path is usually a variable/unknown directory name,
        // so strip it to ensure the library can always be found
        var firstSlash = path.indexOf('/');
        if (firstSlash !== -1) {
          path = path.substring(firstSlash + 1);
        }
        env.path = utils.regExpEscape(path);
      }

      console.log('\nWould you like the library to be minified upon ' +
                  'download?');
      return program.qConfirm('\nMinify the library? ');
    })
    .done(function(minify) {
      if (minify) {
        env.minify = minify;
      }

      console.log('\nAnd that\'s it! Your library will be fetched\n' +
                  'shortly.\n');
      delete env.interactive;

      // call fetch with the updated environment from interactive user input
      exports(libraryName, env);
      process.stdin.destroy();
    });
}

/**
 * Function: minifyFetchedFile
 * ---------------------------
 * Minifies a fetched file given the directory it is in and its name.
 *
 * @param dirName - the directory the fetched file is in
 * @param fileName - the name of the fetched file
 */
function minifyFetchedFile(dirName, fileName) {
  var originalDir;

  if (dirName) {
    originalDir = process.cwd();
    // switch to output dir where the file to minify is located
    process.chdir(dirName);
  }

  return minifyCommand(utils.regExpEscape(fileName),
    { overwrite: true }, true)
    .then(function() {
      if (dirName) {
        // switch back to original dir
        process.chdir(originalDir);
      }
    });
}

/**
 * Function: outputFileData
 * ------------------------
 * Output the given data for a file to the provided file name.
 *
 * @param data - the data of a file
 * @param libraryName - the name of the library to print out to the user
 * @param fileName - if provided, the name of the file to output to
 * @param dirName - if provided, the directory to the store the file in
 */
function outputFileData(data, libraryName, fileName, dirName) {
  var dirDisplay = pathLib.relative('.', dirName);

  // append a slash to dirName if it doesn't already have one
  if (dirName && dirName[dirName.length] !== '/') {
    dirName += '/';
  }

  fs.writeFileSync(dirName + fileName, data);
  console.log('Fetched ' + libraryName + ' into ' + dirDisplay + '/' + fileName + '.');
}

/**
 * Function: downloadFile
 * ----------------------
 * Given a URL of a file, download it and promise the contents.
 *
 * @param url - the URL of the file.
 * @param toFileName - if specified, the contents will be put inside the file
 *  named toFileName and the promise will yield toFileName.
 *
 * @return promise that yields the contents of the file
 */
function downloadFile(url, toFileName) {
  var deferred = q.defer();

  if (!toFileName) {
    // download into RAM
    request(url, function(error, response, body) {
      if (error) {
        deferred.reject(error);
      } else if (response.statusCode != 200) {
        deferred.reject(new Error('Bad response status code ' +
          response.statusCode));
      } else {
        deferred.resolve(body);
      }
    });
  } else {
    var fileRequest = request(url);

    fileRequest.on('error', function(error) {
      deferred.reject(error);
    });

    fileRequest.on('end', function() {
      deferred.resolve(toFileName);
    });

    // download to the given file by piping it to a write stream
    fileRequest.pipe(fs.createWriteStream(toFileName));
  }

  return deferred.promise;
}
