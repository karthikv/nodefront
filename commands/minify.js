var fs = require('fs');
var pathLib = require('path');
var utils = require('../lib/utils');
var parser = require('uglify-js').parser;
var uglify = require('uglify-js').uglify;
var cssmin = require('../lib/cssmin');

/**
 * Node Module Export
 * ------------------
 * Exports the minify command for nodefront. This minifies CSS/JS files.
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
 *  incorrect extension, this parameter may be used. Use "css" for CSS files
 *  and "js" for JS files. Note that this determines which minifier is used.
 */
module.exports = exports = function(rsFilter, env) {
  var rFilter = new RegExp(rsFilter);
  utils.readDirWithFilter('.', env.recursive, rFilter, true)
    .then(function(files) {
      files.forEach(function(fileName) {
        // skip dot files
        if (pathLib.basename(fileName)[0] === '.') {
          return;
        }

        var extension = env.type;
        var fileNameSansExtension;

        if (extension === 'css' || extension === 'js') {
          // if type is explicitly specified, don't try to extract extension
          fileNameSansExtension = fileName;
        } else {
          extension = utils.getExtension(fileName);
          fileNameSansExtension = fileName.substring(0, fileName.length -
            extension.length - 1); // extra one for the dot
        }

        var nextExtension = utils.getExtension(fileNameSansExtension);
        if (nextExtension === 'min') { // file was named *.min.ext
          var relativeFileName = pathLib.relative('.', fileName);
          console.log('Skipping ' + relativeFileName + ' because it seems to' +
                      ' be minified already.');
          return;
        }

        // replace {{ name }} and {{ extension }} with their respective values
        var toFileName = env.out;
        toFileName = toFileName.replace(/\{\{\s*name\s*\}\}/,
          fileNameSansExtension);
        toFileName = toFileName.replace(/\{\{\s*extension\s*\}\}/, extension);

        minify(fileName, toFileName, env.type);
      });
    })
    .end();
};

/**
 * Function: minify
 * ----------------
 * Minifies the given fileName's contents and stores the result in toFileName.
 * Determines whether to use CSS or JS minification based on fileName's
 * extension. The minifier can be forced to use CSS or JS minification by
 * specifying "css" or "js", respectively, for the type parameter.
 *
 * @param fileName - the name of the file to minify
 * @param toFileName - the name of the file to store the minified contents into
 * @param type - the type of the file used to determine whether to use CSS or
 *  JS minification; if not provided, the type is determined via fileName's
 *  extension.
 */
function minify(fileName, toFileName, type) {
  var relativeFileName = pathLib.relative('.', fileName);
  var relativeToFileName = pathLib.relative('.', toFileName);

  // use the extension if a type isn't specified
  if (type !== 'css' && type !== 'js') {
    type = utils.getExtension(fileName);
  }

  if (type !== 'css' && type !== 'js') {
    console.error('Skipping ' + relativeFileName + ' because the type could' +
                  ' not be determined. Please specify this explicitly with' +
                  ' the -t/--type parameter.');
    return;
  }

  utils.readFile(fileName)
    .then(function(contents) {
      var newContents;

      if (type === 'css') {
        // use Yahoo's YUI compressor to minify
        newContents = cssmin.minify(contents);
      } else {
        try {
          // use uglify-js to minify
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
    .then(function(newContents) {
      utils.writeFile(toFileName, newContents)
        .then(function() {
          console.log('Successfully minified ' + relativeFileName + ' to ' +
                      relativeToFileName + '.');
        });
    })
    .end();
}
