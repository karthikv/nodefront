var fs = require('fs');
var q = require('q');
var pathLib = require('path');
var build = require('consolidate-build');
var utils = require('../lib/utils');

// files with these extensions need to be compiled;
// map of extension to compile => resultant compiled extension
var compiledExtensions = {
  coffee: 'js',
  dust: 'html',
  eco: 'html',
  ejs: 'html',
  haml: 'html',
  'haml-coffee': 'html',
  handlebars: 'html',
  hogan: 'html',
  jade: 'html',
  jazz: 'html',
  jqtpl: 'html',
  just: 'html',
  less: 'css',
  liquor: 'html',
  markdown: 'html',
  mustache: 'html',
  qejs: 'html',
  swig: 'html',
  sass: 'css',
  styl: 'css',
  stylus: 'css',
  underscore: 'html',
  walrus: 'html',
  whiskers: 'html'
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
 * Exports the compile command for nodefront. This finds all *.jade, *.styl,
 * *.stylus, and *.coffee target files in the current directory and compiles
 * them to corresponding *.html, *.css, and *.js.
 *
 * @param env - the command-line environment
 *  If the -r/--recursive flag is specified, the current directory is
 *  recursively searched for target files.
 *
 *  If the -w/--watch flag is specified, target files are recompiled upon
 *  modification. Dependencies are also evaluated so that if, for example,
 *  layout.jade includes index.jade, when index.jade is modified, both
 *  index.jade and layout.jade are recompiled. This is referred to as
 *  "dependency-intelligent" recompilation
 *  
 * @param shouldPromise - if true, returns a promise that yields completion
 */
module.exports = exports = function(env, shouldPromise) {
  var promise = findFilesToCompile(env.recursive)
    .then(function(compileData) {
      var promises = [];

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
        promises.push(compileFn());

        if (env.watch) {
          // record dependencies for dependency-intelligent recompilation
          recordDependencies(fileName, extension, contents);
          recompileUponModification(fileName, extension);
        }
      });

      return q.all(promises);
    });

  if (shouldPromise) {
    return promise;
  } else {
    promise.end();
  }
};

/**
 * Function: recompileUponModification
 * -----------------------------------
 * Recompiles the given file upon modification. This also recompiles any files
 * that depend on this file.
 *
 * @param fileName - the name of the file
 * @param extension - the extension of the file
 */
function recompileUponModification(fileName, extension) {
  utils.watchFileForModification(fileName, 1000, function() {
    q.ncall(fs.readFile, fs, fileName, 'utf8')
      .then(function(contents) {
        // this may be a static file that doesn't have a compile function, but
        // is a dependency for some other compiled file
        if (compileFns[fileName]) {
          compileFns[fileName]()
            .end();

          // reset dependencies
          clearDependencies(fileName);
          recordDependencies(fileName, extension, contents);
        }

        // compile all files that depend on this one
        for (var dependentFile in dependents[fileName]) {
          console.log('Compiling dependent:', dependentFile);
          if (compileFns[dependentFile]) {
            compileFns[dependentFile]()
              .end();
          }
        }
      })
      .end();
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
 * file based off of its type (jade, stylus, coffee, etc.).
 *
 * @param fileNameSansExtension - file name without extension
 * @param extension - the extension of the file name
 *
 * @return function to compile this file that takes no parameters
 */
function generateCompileFn(fileNameSansExtension, extension) {
  return function() {
    var fileName = fileNameSansExtension + '.' + extension;
    // always default to compressing files
    var options = { compress: true };

    // consolidate-build will take care of picking which compiler to use;
    // simply use the file extension as a key
    return q.ncall(build[extension], build[extension], fileName, options)
      .then(function(output) {
        var newExtension = compiledExtensions[extension];
        var compiledFileName = fileNameSansExtension + '.' + newExtension;
        var compiledFileDisplay = pathLib.relative('.', compiledFileName);

        return utils.writeFile(compiledFileName, output)
          .then(function() {
            console.log('Compiled ' + compiledFileDisplay + '.');
          });
      })
      .fail(function(error) {
        // if a compilation error occurs, don't end the program; simply notify
        // the user of the issue
        console.error(error.message);
      });
  };
}

/**
 * Function: findFilesToCompile
 * ----------------------------
 * Reads the current directory and promises a list of files along with their
 * contents.
 *
 * @param recursive - true to read the current directory recursively
 * @return promise that yields an array of arrays in the form
 *  [ [file_name_1_without_extension, file_name_1_extension, contents_1],
 *  [file_name_2_without_extension, file_name_2_extension, contents_2], ... ].
 */
function findFilesToCompile(recursive) {
  var rsFilter = '\\.(';
  for(var extension in compiledExtensions) {
    rsFilter += extension + '|';
  }
  rsFilter = rsFilter.substr(0, rsFilter.length - 1) + ')$';

  return utils.readDirWithFilter('.', recursive, new RegExp(rsFilter), true)
    .then(function(files) {
      var deferred = q.defer();

      // contains arrays of [file name sans extension, extension, contents]
      // i.e. for index.jade, array would be ['index', 'jade', contents of
      // index.jade]
      var compileData = [];
      var numFiles = files.length;

      files.forEach(function(file, index) {
        // extract extension and contents of current file
        var extensionLoc = file.lastIndexOf('.');
        var extension = file.substr(extensionLoc + 1);

        q.ncall(fs.readFile, fs, file, 'utf8')
          .then(function(contents) {
            compileData.push([file.substr(0, extensionLoc),
                extension, contents]);

            // done? if so, resolve with compileData
            if (index == numFiles - 1) {
              deferred.resolve(compileData);
            }
          })
          .end();
      });

      return deferred.promise;
    });
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
