var fs = require('fs');
var pathLib = require('path');
var q = require('q');
var utils = require('../lib/utils');
var parser = require('uglify-js').parser;
var uglify = require('uglify-js').uglify;
var cssmin = require('../lib/cssmin');
var exec = require('child_process').exec;

var allowedExtensions = {
  'js': undefined,
  'css': undefined,
  'jpg': undefined,
  'jpeg': undefined,
  'png': undefined
};

/**
 * Node Module Export
 * ------------------
 * Exports the minify command for nodefront. This minifies CSS/JS files and
 * optimizes images.
 *
 * @param rsFilter - the regular expression that matches CSS/JS files
 * @param env - the command-line environment
 *  If the -r/--recursive flag is specified, minify will look for files that
 *  match rsFilter in all sub-directories as well.
 *
 *  If the -o/--out <file> parameter is specified, the output of the
 *  minification will be stored in a file named <file>. Include {{ name }} in
 *  <file> and it will be replaced with the original file name sans extension.
 *  Include {{ extension }} and it will be replaced with the original file's
 *  extension. For example, if the original file is called "script.js",
 *  {{ name }} will be replaced by "script" and {{ extension }} will be
 *  replaced by "js". Default is "{{ name }}.min.{{ extension }}".
 *
 *  If the -t/--type <type> parameter is specified, the files matched by
 *  rsFilter will be treated as if they were of type <type>. Normally, types
 *  are determined by the extension of files, but if a file lacks or has an
 *  incorrect extension, this parameter may be used. Use "css" for CSS files,
 *  "js" for JS files, "jpg" or "jpeg" for JPEG files, and "png" for PNG files.
 *  Note that this determines which minifier/optimizer is used.
 *
 * @param shouldPromise - if true, returns a promise that yields completion
 */
module.exports = exports = function(rsFilter, env, shouldPromise) {
  if (env.plain && rsFilter) {
    rsFilter = utils.regExpEscape(rsFilter);
    rsFilter = rsFilter + '$';
  }

  var types = [];

  // collect all shortcut types into one array
  if (env.css) {
    types.push('css');
  }
  if (env.js) {
    types.push('js');
  }
  if (env.images) {
    types.push('jpg');
    types.push('jpeg');
    types.push('png');
  }

  if (types.length > 0) {
    // construct a regex based of the types
    rsFilter = '\\.(' + types.join('|') + ')$';
  }

  if (!rsFilter) {
    console.error('You must provide a regular expression or a shortcut' +
                  ' parameter(s) to specify which files to minify.');
    return;
  }

  if (rsFilter.indexOf('/') !== -1 && !env.recursive) {
    // if a slash is present in the fileRegex, it is likely that the user wants
    // to minify a file in another directory, so add in the recursive option
    console.log('Automatically adding recursive option because file target' +
                ' looks to be in another directory.');
    env.recursive = true;
  }

  var rFilter = new RegExp(rsFilter);
  var promise = utils.readDirWithFilter('.', env.recursive, rFilter, true)
    .then(function(files) {
      return q.all(files.map(function(fileName) {
        // skip dot files
        if (pathLib.basename(fileName)[0] === '.') {
          return;
        }

        var extension = env.type;
        var fileNameSansExtension;
        var relativeFileName = pathLib.relative('.', fileName);

        if (extension in allowedExtensions) {
          // if type is explicitly specified, don't try to extract extension
          fileNameSansExtension = fileName;
        } else {
          extension = utils.getExtension(fileName);
          if (!(extension in allowedExtensions)) {
            console.error('Skipping ' + relativeFileName + ' because the' +
                          ' type could not be determined. Please specify' +
                          ' this explicitly with the -t/--type parameter.');
            return;
          }

          fileNameSansExtension = fileName.substring(0, fileName.length -
            extension.length - 1); // extra one for the dot
        }

        var nextExtension = utils.getExtension(fileNameSansExtension);
        if (nextExtension === 'min') { // file was named *.min.ext
          console.log('Skipping ' + relativeFileName + ' because it seems to' +
                      ' be minified already.');
          return;
        }

        var toFileName;
        if (env.overwrite) {
          // write to the same file
          toFileName = fileName;
        } else {
          // replace {{ name }} and {{ extension }} with their respective values
          toFileName = env.out;
          toFileName = toFileName.replace(/\{\{\s*name\s*\}\}/,
            pathLib.basename(fileNameSansExtension));
          toFileName = toFileName.replace(/\{\{\s*extension\s*\}\}/, extension);

          // toFileName should be in same directory as fileName
          toFileName = pathLib.dirname(fileName) + '/' + toFileName;
        }

        // return a promise for q.all
        return minify(fileName, toFileName, extension);
      }));
    });

  if (shouldPromise) {
    return promise;
  } else {
    promise.done();
  }
};

/**
 * Function: minify
 * ----------------
 * Minifies the given fileName's contents and stores the result in toFileName.
 * Determines whether to use CSS, JS, JPEG, or PNG minification/optimization
 * based on the given type parameter. Specify "css" for CSS, "js" for JS, "jpg"
 * or "jpeg" for JPEG, and "png" for PNG.
 *
 * @param fileName - the name of the file to minify
 * @param toFileName - the name of the file to store the minified contents into
 * @param type - the type of the file used to determine what
 *  minification/optimization should be used.
 *
 * @return promise that yields completion
 */
function minify(fileName, toFileName, type) {
  var deferred = q.defer();
  var relativeFileName = pathLib.relative('.', fileName);
  var relativeToFileName = pathLib.relative('.', toFileName);

  /**
   * Function: imageExecCallback
   * ---------------------------
   * Given the error, standard output, and standard error output of a shell
   * command, throw an error if one occurred and print an optimization message
   * otherwise.
   *
   * @param error - the error that occurred, if any
   * @param stdout - the standard output
   * @param stderr - the standard error output
   */
  function imageExecCallback(error, stdout, stderr) {
    if (error) {
      deferred.reject(error);
    } else {
      console.log('Optimized ' + relativeFileName + ' to ' +
                  relativeToFileName + '.');
      deferred.resolve();
    }
  }

  if (type === 'png') {
    // use optipng to optimize PNG
    exec('optipng -o4 -out ' + toFileName + ' ' + fileName,
      function(error, stdout, stderr) {
        // remove backup file created by optipng
        exec('rm ' + toFileName + '.bak');
        imageExecCallback(error, stdout, stderr);
      });
  } else if (type === 'jpg' || type === 'jpeg') {
    // use jpegtran to optimize JPEG
    exec('jpegtran -optimize -progressive -outfile ' + toFileName + ' ' +
      fileName, imageExecCallback);
  } else {
    utils.readFile(fileName)
      .then(function(contents) {
        var newContents;

        if (type === 'css') {
          // use Yahoo's YUI compressor to minify CSS
          newContents = cssmin.minify(contents);
        } else if (type === 'js') {
          try {
            // use uglify-js to minify JS
            var ast = parser.parse(contents);
            ast = uglify.ast_mangle(ast);
            ast = uglify.ast_squeeze(ast);
            newContents = uglify.gen_code(ast);
          } catch(error) {
            throw new Error(error);
          }
        }

        return newContents;
      })
      .done(function(newContents) {
        utils.writeFile(toFileName, newContents)
          .then(function() {
            console.log('Minified ' + relativeFileName + ' to ' +
                        relativeToFileName + '.');
            deferred.resolve();
          });
      });
  }

  return deferred.promise;
}
