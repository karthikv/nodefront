var fs = require('fs');
var q = require('q');
var jade = require('jade');
var stylus = require('stylus');
var pathLib = require('path');
var utils = require('../utils');

// files with these extensions need to be compiled
var compiledExtensions = {
  'jade': undefined,
  'styl': undefined,
  'stylus': undefined
};

// compile functions for each file; file name => function map
var compileFns = {};

// what files are dependent on a given file; file => dependents map
var dependents = {};

// what are a given file's dependencies; file => dependencies map; inverse of
// above map
var dependencies = {};

// regular expressions for finding dependencies
var rJadeInclude = /^[ \t]*include[ \t]+([^\n]+)/gm;
var rJadeExtends = /^[ \t]*extends?[ \t]+([^\n]+)/gm;
var rStylusInclude = /^[ \t]*@import[ \t]+([^\n]+)/gm;

/**
 * Node Module Export
 * ------------------
 * Exports the compile command for nodefront. This finds all *.jade and *.styl
 * target files in the current directory and compiles them to corresponding
 * *.html and *.css.
 *
 * @param env - the command-line environment
 *  If the -r/--recursive parameter is specified, the current directory is
 *  recursively searched for target files.
 *
 *  If the -w/--watch parameter is specified, target files are recompiled upon
 *  modification. Dependencies are also evaluated so that if, for example,
 *  layout.jade includes index.jade, when index.jade is modified, both
 *  index.jade and layout.jade are recompiled. This is referred to as
 *  "dependency-intelligent" recompilation
 */
module.exports = exports = function(env) {
  findFilesToCompile(env.recursive)
    .then(function(compileData) {
      // process each file to compile
      compileData.forEach(function(compileDatum) {
        // compileDatum is in the form [file_name_without_extension, extension,
        // contents]; extract this information
        var fileNameSansExtension = compileDatum[0];
        var extension = compileDatum[1];
        var contents = compileDatum[2];
        var fileName = fileNameSansExtension + '.' + extension;

        // compile the current file and record this function
        var compileFn = generateCompileFn(fileNameSansExtension, extension,
            contents);
        compileFns[fileName] = compileFn;
        compileFn();

        if (env.watch) {
          // record dependencies for dependency-intelligent recompilation
          recordDependencies(fileName, extension, contents);
          recompileUponModification(fileName, extension);
        }
      });
    })
    .fail(utils.throwError);
};

/**
 * Function: recompileUponModification
 * -----------------------------------
 * Recompiles the given file upon modification. This also recompiles any files
 * that depend on this file.
 *
 * @param fileName - the name of the file
 */
function recompileUponModification(fileName, extension) {
  fs.watchFile(fileName, {
    persistent: true,
    interval: 1500
  }, function(curStat, oldStat) {
    // watchFile fires callback on any stat changes; check specifically that
    // the file has been modified
    if (curStat.mtime > oldStat.mtime) {
      q.ncall(fs.readFile, fs, fileName, 'utf8')
        .then(function(contents) {
          compileFns[fileName]();

          // reset dependencies
          clearDependencies(fileName);
          recordDependencies(fileName, extension, contents);

          // compile all files that depend on this one
          for (var dependentFile in dependents[fileName]) {
            console.log('Compiling dependent:', dependentFile);
            if (compileFns[dependentFile]) {
              compileFns[dependentFile]();
            }
          }
        }).fail(utils.throwError);
    }
  });
}

/**
 * Function: recordDependencies
 * ----------------------------
 * Given a file's name, extension and contents, records its compilation
 * dependencies for use while watching it for changes.
 *
 * @param fileName - the name of the file
 * @param extension - the extension of the file
 * @param contents - the contents of the file
 */
function recordDependencies(fileName, extension, contents) {
  var dirName = pathLib.dirname(fileName);
  var matches;
  var dependencyFile;

  // find dependencies
  switch (extension) {
    case 'jade':
      while ((matches = rJadeInclude.exec(contents)) ||
            (matches = rJadeExtends.exec(contents))) {
        dependencyFile = matches[1];

        // if no extension is provided, use .jade
        if (dependencyFile.indexOf('.') === -1) {
          dependencyFile += '.jade';
        }

        dependencyFile = pathLib.resolve(dirName, dependencyFile);
        // this file is dependent upon dependencyFile
        // TODO: this currently only works with .jade dependency
        // files; add support for static files later on
        addDependency(dependencyFile, fileName);
      }
      break;

    case 'styl':
    case 'stylus':
      while ((matches = rStylusInclude.exec(contents))) {
        dependencyFile = matches[1];

        // if no extension is provided, use .styl
        if (dependencyFile.indexOf('.') === -1) {
          dependencyFile += '.styl';
          dependencyFile = pathLib.resolve(dirName, dependencyFile);

          // this may be an index include; resolve it
          try {
            fs.statSync(dependencyFile);
          } catch (e) {
            // actually including /index.styl
            dependencyFile = matches[1] + '/index.styl';
          }
        }

        addDependency(dependencyFile, fileName);
      }
      break;
  }
}

/**
 * Function: generateCompileFn
 * ---------------------------
 * Given a file name and its extension, returns a function that compiles this
 * file based off of its type (jade, stylus, etc.).
 *
 * @param fileNameSansExtension - file name without extension
 * @param extension - the extension of the file name
 *
 * @return function to compile this file that takes no parameters
 */
function generateCompileFn(fileNameSansExtension, extension) {
  return function() {
    var fileName = fileNameSansExtension + '.' + extension;
    var contents = fs.readFileSync(fileName, 'utf8');

    switch (extension) {
      case 'jade':
        // run jade's render
        q.ncall(jade.render, jade, contents, {
          filename: fileName
        })
          .then(function(outputHTML) {
            writeFile(fileNameSansExtension + '.html', outputHTML);
          }).fail(utils.throwError);
        break;

      case 'styl':
      case 'stylus':
          // run stylus' render
          q.ncall(stylus.render, stylus, contents, {
            filename: fileName,
            compress: true
          })
            .then(function(outputCSS) {
              writeFile(fileNameSansExtension + '.css', outputCSS);
            }).fail(utils.throwError);
        break;
    }
  };
}

/**
 * Function: findFilesToCompile
 * ----------------------------
 * Reads the current directory and promises a list of files along with their
 * contents.
 *
 * @param recursive - whether to read the current directory recursively
 * @return promise that yields an array of arrays in the form
 *  [ [file_name_1_without_extension, file_name_1_extension, contents_1],
 *  [file_name_2_without_extension, file_name_2_extension, contents_2], ... ].
 */
function findFilesToCompile(recursive) {
  var promise;

  // normal or recursive directory reading
  if (recursive) {
    promise = utils.readDirRecursive('.');
  } else {
    promise = q.ncall(fs.readdir, {}, '.');
  }

  // go through each file/directory in the current directory
  return promise
    .then(function(dirList) {
      var deferred = q.defer();
      var files = [];
      var numPaths = dirList.length;

      // filter to only files
      dirList.forEach(function(path, index) {
        q.ncall(fs.stat, fs, path)
          .then(function(stat) {
            if (stat.isFile()) {
              files.push(path);
            }

            // done? if so, resolve with the files
            if (index == numPaths - 1) {
              deferred.resolve(files);
            }
          }).fail(utils.throwError);
      });

      return deferred.promise;
    })
    .then(function(files) {
      var deferred = q.defer();

      // contains arrays of [file name sans extension, extension, contents]
      // i.e. for index.jade, array would be ['index', 'jade', contents of
      // index.jade]
      var compileData = [];
      var numFiles = files.length;

      files.forEach(function(file, index) {
        var extensionLoc = file.lastIndexOf('.');
        var extension;

        // don't try to compile files without extensions
        if (extensionLoc === -1) {
          return;
        }

        // extract extension and contents of current file
        extension = file.substr(extensionLoc + 1);
        if (!(extension in compiledExtensions)) {
          return;
        }

        q.ncall(fs.readFile, fs, file, 'utf8')
          .then(function(contents) {
            compileData.push([file.substr(0, extensionLoc),
                extension, contents]);

            // done? if so, resolve with compileData
            if (index == numFiles - 1) {
              deferred.resolve(compileData);
            }
          }).fail(utils.throwError);
      });

      return deferred.promise;
    });
}

/**
 * Function: writeFile
 * -------------------
 * Writes the given file and contents.
 *
 * @param fileName - the file name to write to
 * @param contents - the contents of the file name
 */
function writeFile(fileName, contents) {
  q.ncall(fs.writeFile, fs, fileName, contents)
    .then(function() {
      console.log('Compiled ' + fileName + '.');
    }).fail(utils.throwError);
}

/**
 * Function: addDependency
 * -----------------------
 * Records a compilation dependency.
 *
 * @param fileName - the file name that dependent depends upon
 * @param dependent - the file name that is dependent on fileName
 */
function addDependency(fileName, dependent) {
  // add to dependents map
  if (!dependents[fileName]) {
    dependents[fileName] = {};
  }
  dependents[fileName][dependent] = true;

  // add to dependencies map
  if (!dependencies[dependent]) {
    dependencies[dependent] = {};
  }
  dependencies[dependent][fileName] = true;
}

/**
 * Function: clearDependencies
 * ---------------------------
 * Clear the dependencies of the given file.
 *
 * @param fileName - the name of the file
 */
function clearDependencies(fileName) {
  // clear dependents map
  for (var dependency in dependencies[fileName]) {
    delete dependents[dependency][fileName];
  }

  // clear dependency map
  delete dependencies[fileName];
}
