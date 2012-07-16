var fs = require('fs');
var request = require('request');
var libraries = require('nconf');
var q = require('q');
var Zip = require('adm-zip');

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
 */
module.exports = exports = function(libraryName, env) {
  var url = env.url;
  var path = env.path;
  var version = env.version;
  var type = env.type;

  // normalize library names to lowercase
  libraryName = libraryName.toLowerCase();

  if (!url) {
    // find library information in the libraries file
    var library = libraries.get(libraryName);
    if (!library) {
      console.error('Could not find library ' + libraryName + '. Please' +
        ' specify a URL via the -u/--url parameter.');
      return;
    }

    url = library.url;
    path = library.path;

    type = library.type || 'js';
    if (!version) {
      // if no version was specified, assume the user wants the latest
      version = library.latest;
    }

    url = url.replace('{{ version }}', version);
  }

  var fileName;
  if (version) {
    fileName = libraryName + '-' + version + '.' + type;
  } else {
    fileName = libraryName + '.' + type;
  }

  var dirName = env.output;
  if (url && path) {
    // download the zip archive to a temporary file
    var toFileName = 'nodefront-' + libraryName + '-tmp';

    downloadFile(url, toFileName)
      .then(function() {
        var pathRegex = new RegExp(path);
        var zip = new Zip(toFileName);

        var entries = zip.getEntries();
        var foundPath = false;

        // find the path that matches the regular expression
        for (var i = 0; i < entries.length; i++) {
          if (pathRegex.test(entries[i].entryName)) {
            foundPath = true;
            console.log('Matched path ' + entries[i].entryName);

            // output it
            outputFileData(zip.readAsText(entries[i]), libraryName, fileName,
              dirName);
            break;
          }
        }

        if (!foundPath) {
          console.error('The path you specified could not be found.');
        }
      })
      .fin(function() {
        // delete the temporary file
        fs.unlinkSync(toFileName);
      })
      .end();
  } else if (url) {
    // download the file at the URL and output it
    downloadFile(url)
      .then(function(data) {
        outputFileData(data, libraryName, fileName, dirName);
      })
      .end();
  }
};

/**
 * Function: outputFileData
 * ------------------------
 * Given the data of a file to output, log it to the console or save it as the
 * given file name.
 *
 * @param data - the data of a file
 * @param libraryName - the name of the library to print out to the user
 * @param fileName - if provided, the name of the file to output to
 * @param dirName - if provided, the directory to the store the file in
 */
function outputFileData(data, libraryName, fileName, dirName) {
  // append a slash to dirName if it doesn't already have one
  if (dirName[dirName.length] !== '/') {
    dirName += '/';
  }

  fs.writeFileSync(dirName + fileName, data);
  console.log('Fetched ' + libraryName + ' into ' + dirName + fileName);
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
