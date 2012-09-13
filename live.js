(function() {
  // file and dir path of currently-viewed HTML page
  var currentFilePath = location.pathname;

  // paths ending in / are directories that represent index.html
  if (currentFilePath.charAt(currentFilePath.length - 1) === '/') {
    currentFilePath += 'index.html';
  }

  var currentDirPath = location.pathname.substr(0,
    location.pathname.lastIndexOf('/'));

  // socket communication
  var socket = io.connect();

  // link tag information
  var linkTags = document.querySelectorAll('link');
  var linkTag;
  var linkHref;

  // map of absolute source path => [link tag, original source path]
  var linkSources = {};
  var linkSourceList = [];

  // script tag information
  var scriptTags = document.querySelectorAll('script');
  var scriptTag;
  var scriptSrc;

  // map of absolute source path => [script tag, original source path]
  var scriptSources = {};
  var scriptSourceList = [];

  var i;

  // record sources of all JS files
  for (i = 0; i < scriptTags.length; i++) {
    scriptTag = scriptTags[i];
    scriptSrc = scriptTag.getAttribute('src');

    // record only if src exists
    if (scriptSrc) {
      scriptSrc = scriptSrc.split('?')[0];
      origScriptSrc = scriptSrc;

      // make path relative to root
      if (scriptSrc[0] !== '/') {
        scriptSrc = currentDirPath + '/' + scriptSrc;
      }
      scriptSources[scriptSrc] = [scriptTag, origScriptSrc];
    }
  }

  // record sources of all CSS files
  for (i = 0; i < linkTags.length; i++) {
    linkTag = linkTags[i];
    linkHref = linkTag.getAttribute('href');

    // record only if href exists
    if (linkHref) {
      linkHref = linkHref.split('?')[0];
      origLinkHref = linkHref;

      // make path relative to root
      if (linkHref[0] !== '/') {
        linkHref = currentDirPath + '/' + linkHref;
      }
      linkSources[linkHref] = [linkTag, origLinkHref];
    }
  }

  // extract keys to get a list of link/script sources
  for (var linkSource in linkSources) {
    linkSourceList.push(linkSource);
  }

  for (var scriptSource in scriptSources) {
    scriptSourceList.push(scriptSource);
  }

  // paths need to be normalized; have the server make them absolute
  socket.emit('resolvePaths', [currentFilePath, linkSourceList,
    scriptSourceList]);

  socket.on('pathsResolved', function(paths) {
    // paths is now an array of absolute file paths
    var origSource;
    currentFilePath = paths[0];

    // paths[1] and paths[2] are objects of the form:
    // {
    //  absolute path 1: original path 1,
    //  absolute path 2: original path 2,
    //  ...
    // }
    for (var linkSource in paths[1]) {
      origSource = paths[1][linkSource];
      linkSources[linkSource] = linkSources[origSource];
      delete linkSources[origSource];
    }

    for (var scriptSource in paths[2]) {
      origSource = paths[2][scriptSource];
      scriptSources[scriptSource] = scriptSources[origSource];
      delete scriptSources[origSource];
    }
  });

  socket.on('fileModified', function(filePath) {
    if (filePath in linkSources) {
      linkTag = linkSources[filePath][0];
      // add cache-busting query string to force the browser to reload this css
      linkTag.setAttribute('href', linkSources[filePath][1] + '?' +
        new Date().getTime());
    } else if (filePath in scriptSources || filePath == currentFilePath) {
      // true parameter forces browser to skip cache
      location.reload(true);
    }
  });
}());
