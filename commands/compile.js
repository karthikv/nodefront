var fs = require('fs');
var q = require('q');
var jade = require('jade');
var stylus = require('stylus');
var pathLib = require('path');
var utils = require('../lib/utils');

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
 *  If the -r/--recursive flag is specified, the current directory is
 *  recursively searched for target files.
 *
 *  If the -w/--watch flag is specified, target files are recompiled upon
 *  modification. Dependencies are also evaluated so that if, for example,
 *  layout.jade includes index.jade, when index.jade is modified, both
 *  index.jade and layout.jade are recompiled. This is referred to as
 *  "dependency-intelligent" recompilation
 *
 *  If the -s/--serve <port> flag is specified, the files in the current
 *  directory are served on localhost at the given port number, which
 *  defaults to 3000.
 *
 *  If the -l/--live <port> flag is specified, -w/--watch and -s/--serve <port>
 *  are implied. Not only are files recompiled upon modification, but the
 *  browser is also automatically updated when corresponding HTML/CSS/JS/Jade/
 *  Stylus files are altered. In the case of CSS/Stylus, link tags on the page
 *  are simply removed and re-added. For HTML/JS/Jade, the browser is refreshed
 *  entirely.
 */
module.exports = exports = function(env) {
  var server;
  var io;

  if (env.serve || env.live) {
    // serve the files on localhost
    if (typeof env.serve == 'number') {
      server = serveFilesLocally(env.serve, env.live);
    } else {
      server = serveFilesLocally(3000, env.live);
    }
  }

  if (env.live) {
    // initiate the socket connection
    io = require('socket.io').listen(server);

    io.sockets.on('connection', function(socket) {
      socket.on('resolvePaths', function(paths) {
        var resolvedPaths = [];
        var absPath;

        // use path library to resolve paths
        resolvedPaths[0] = pathLib.resolve('.' + paths[0]);
        resolvedPaths[1] = {};
        resolvedPaths[2] = {};

        // resolve each path in the latter two arrays, keeping track of the new
        // path and original in a map of new => original
        for (var i = 1; i <= 2; i++) {
          for (var j = 0; j < paths[i].length; j++) {
            absPath = pathLib.resolve('.' + paths[i][j]);
            resolvedPaths[i][absPath] = paths[i][j];
          }
        }

        // let the client know
        socket.emit('pathsResolved', resolvedPaths);
      });
    });
  }

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
            contents, env.live);
        compileFns[fileName] = compileFn;
        compileFn();

        if (env.watch || env.live) {
          // record dependencies for dependency-intelligent recompilation
          recordDependencies(fileName, extension, contents);
          recompileUponModification(fileName, extension, io);
        }
      });
    })
    .end();

  if (env.live) {
    // communicate to client whenever file is modified
    trackModificationsLive(io, env.recursive);
  }
};

/**
 * Function: trackModificationsLive
 * --------------------------------
 * Watch all HTML, CSS, and JS files for modifications. Emit a fileModified
 * event to the client upon modification to allow for live refreshes.
 *
 * @param io - socket.io connection if this is live mode
 * @param recursive - true to watch all files in subdirectories as well
 */
function trackModificationsLive(io, recursive) {
  utils.readDirWithFilter('.', true, /\.(html|css|js)$/, true)
    .then(function(files) {
      files.forEach(function(fileName) {
        // use a small interval for quick live refreshes
        utils.watchFileForModification(fileName, 200, function() {
          io.sockets.emit('fileModified', fileName);
        });
      });
    });
}

/**
 * Function: serveFilesLocally
 * ---------------------------
 * Serves the files in the current directory on localhost at the given port
 * number.
 *
 * @param port - the port number to serve the files on
 * @param live - true if this is live mode
 *
 * @return the node HTTP server
 */
function serveFilesLocally(port, live) {
  var http = require('http');
  var mime = require('mime');

  if (live) {
    // scripts to dynamically insert into html pages
    var scripts = '<script src="/socket.io/socket.io.js"></script>' +
      '<script src="/nodefront/live.js"></script>';
  }

  var server = http.createServer(function(request, response) {
    if (request.method == 'GET') {
      // file path in current directory
      var path = '.' + request.url.split('?')[0];
      var mimeType = mime.lookup(path, 'text/plain');
      var charset = mime.charsets.lookup(mimeType, '');
      var binary = charset !== 'UTF-8';

      // redirect /nodefront/live.js request to nodefront's live.js
      if (live && path === './nodefront/live.js') {
        path = pathLib.resolve(__dirname + '/../live.js');
      }
      
      // if file exists, serve it; otherwise, return a 404
      utils.readFile(path, binary)
        .then(function(contents) {
          // find this file's mime type or default to text/plain
          response.writeHead(200, {'Content-Type': mimeType});

          if (live && mimeType === 'text/html') {
            // add scripts before end body tag
            contents = contents.replace('</body>', scripts + '</body>');

            // if no end body tag is present, just append scripts
            if (contents.indexOf(scripts) === -1) {
              contents = contents + scripts;
            }
          }

          if (binary) {
            response.end(contents, 'binary');
          } else {
            response.end(contents);
          }
        }, function(err) {
          response.writeHead(404, {'Content-Type': 'text/plain'});
          response.end('File not found.');
        })
        .end();
    } else {
      // bad request error code
      response.writeHead(400, {'Content-Type': 'text/plain'});
      response.end('Unsupported request type.');
    }
  }).listen(port, '127.0.0.1');

  console.log('Serving your files at http://127.0.0.1:' + port + '/.');
  return server;
}

/**
 * Function: recompileUponModification
 * -----------------------------------
 * Recompiles the given file upon modification. This also recompiles any files
 * that depend on this file.
 *
 * @param fileName - the name of the file
 * @param extension - the extension of the file
 */
function recompileUponModification(fileName, extension, io) {
  utils.watchFileForModification(fileName, 1000, function() {
    q.ncall(fs.readFile, fs, fileName, 'utf8')
      .then(function(contents) {
        // this may be a static file that doesn't have a compile function, but
        // is a dependency for some other compiled file
        if (compileFns[fileName]) {
          compileFns[fileName]();

          // reset dependencies
          clearDependencies(fileName);
          recordDependencies(fileName, extension, contents);
        }

        // compile all files that depend on this one
        for (var dependentFile in dependents[fileName]) {
          console.log('Compiling dependent:', dependentFile);
          if (compileFns[dependentFile]) {
            compileFns[dependentFile]();
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
 * file based off of its type (jade, stylus, etc.).
 *
 * @param fileNameSansExtension - file name without extension
 * @param extension - the extension of the file name
 * @param live - true if this is live mode
 *
 * @return function to compile this file that takes no parameters
 */
function generateCompileFn(fileNameSansExtension, extension, live) {
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
            var compiledFileName = fileNameSansExtension + '.html';

            utils.writeFile(compiledFileName, outputHTML)
              .then(function() {
                console.log('Compiled ' + compiledFileName + '.');
              });
          })
          .end();
        break;

      case 'styl':
      case 'stylus':
          // run stylus' render
          q.ncall(stylus.render, stylus, contents, {
            filename: fileName,
            compress: true
          })
            .then(function(outputCSS) {
              var compiledFileName = fileNameSansExtension + '.css';
              utils.writeFile(compiledFileName, outputCSS)
                .then(function() {
                  console.log('Compiled ' + compiledFileName + '.');
                });
            })
            .end();
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
