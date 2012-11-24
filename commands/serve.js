var fs = require('fs');
var pathLib = require('path');
var urlLib = require('url');
var q = require('q');
var compile = require('./compile');
var utils = require('../lib/utils');

/**
 * Node Module Export
 * ------------------
 * Exports the serve command for nodefront. This serves files in the current
 * directory on a NodeJS HTTP server.
 *
 * @param port - the port to serve files on; defaults to 3000
 * @param hostname - the hostname to serve files on; defaults to localhost
 * @param env - the command-line environment
 *  If the -c/--compile flag is specified, nodefront compile -rw is run
 *  simultaneously along with this command. This allows templating/built
 *  languages to automatically be compiled to their HTML/CSS/JS counterparts
 *  when modified, making them immediately ready to be served.
 *
 *  If the -l/--live flag is specified, the browser is automatically refreshed
 *  when corresponding HTML/CSS/JS files that affect the current page are
 *  altered. This is done via a socket connection to the client (courtesy of
 *  socket.io).
 *
 * @param shouldPromise - if true, returns a promise that yields completion
 */
module.exports = exports = function(port, hostname, env, shouldPromise) {
  var server;
  var promise;

  port = port || 3000;
  hostname = hostname || '127.0.0.1';

  if (env.compile) {
    // run the compile command
    promise = compile({ recursive: true, watch: true, output: env.output },
      true);
  } else {
    // no need to run any command; just create a promise that resolves
    promise = q.resolve();
  }

  // create the http server
  exports.server = server = serveFilesLocally(port, hostname, env.live);

  if (env.live) {
    // initiate the socket connection
    io = require('socket.io').listen(server);

    // logging is unnecessary
    io.configure(function() {
      io.disable('log');
    });

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

    promise = promise.then(function() {
      // communicate to client whenever file is modified
      trackModificationsLive(io);
    });
  }

  if (shouldPromise) {
    return promise;
  } else {
    promise.done();
  }
};

/**
 * Function: serveFilesLocally
 * ---------------------------
 * Serves the files in the current directory on localhost at the given port
 * number.
 *
 * @param port - the port number to serve the files on
 * @param hostname - the hostname to serve the files on
 * @param live - true if this is live mode
 *
 * @return the node HTTP server
 */
function serveFilesLocally(port, hostname, live) {
  var http = require('http');
  var mime = require('mime');

  if (live) {
    // scripts to dynamically insert into html pages
    var scripts = '<script src="/socket.io/socket.io.js"></script>' +
      '<script src="/nodefront/live.js"></script>';
  }

  var server = http.createServer(function(request, response) {
    /**
     * Function: respondWith404
     * ------------------------
     * Responds with a 404 not found error and a 'File not found.' message.
     */
    function respondWith404() {
      response.writeHead(404, {'Content-Type': 'text/plain'});
      response.end('File not found.');
    }

    if (request.method == 'GET') {
      var urlParts = urlLib.parse(request.url);
      // file path in current directory
      var path = '.' + urlParts.pathname;

      // redirect /nodefront/live.js request to nodefront's live.js
      if (live && path === './nodefront/live.js') {
        path = pathLib.resolve(__dirname + '/../live.js');
      }

      q.ncall(fs.stat, fs, path)
        .then(function(stats) {
          // if this is a directory, assume user wants to serve index.html
          if (stats.isDirectory()) {
            if (path[path.length - 1] !== '/') {
              // redirect to url with an ending slash to signify this is
              // a directory
              urlParts.pathname += '/';
              response.writeHead(301, {'Location': urlLib.format(urlParts)});

              response.done();
              return;
            }

            path += 'index.html';
          }

          var mimeType = mime.lookup(path, 'text/plain');
          var charset = mime.charsets.lookup(mimeType, '');
          var binary = charset !== 'UTF-8';

          // if file exists, serve it; otherwise, return a 404
          utils.readFile(path, binary)
            .done(function(contents) {
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
            }, respondWith404);
        }, respondWith404);
    } else {
      // bad request error code
      response.writeHead(400, {'Content-Type': 'text/plain'});
      response.end('Unsupported request type.');
    }
  }).listen(port, hostname);

  console.log('Serving your files at http://' + hostname + ':' + port + '/.');
  return server;
}

/**
 * Function: trackModificationsLive
 * --------------------------------
 * Watch all HTML, CSS, and JS files for modifications. Emit a fileModified
 * event to the client upon modification to allow for live refreshes.
 *
 * @param io - socket.io connection if this is live mode
 * @return promise that yields completion
 */
function trackModificationsLive(io) {
  return utils.readDirWithFilter('.', true, /\.(html|css|js)$/, true)
    .then(function(files) {
      files.forEach(function(fileName) {
        // use a small interval for quick live refreshes
        utils.watchFileForModification(fileName, 200, function() {
          io.sockets.emit('fileModified', fileName);
        });
      });
    });
}
