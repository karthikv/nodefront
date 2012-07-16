var fs = require('fs');
var pathLib = require('path');
var utils = require('../utils');

// single line whitespace; does not include \n
var rNotWhitespace = /[^ \t]/;

/**
 * Node Module Export
 * ------------------
 * Exports the insert command for nodefront. This inserts CSS/JS libraries into
 * HTML/Jade documents without the need for manually writing link/script tags.
 *
 * @param libraryPath - the path to the library file
 * @param filePath - the path to the HTML/Jade file
 * @param env - the command-line environment
 *  If the -h/--head flag is specified, the provided javascript library will be
 *  inserted into the head of the document instead of the footer.
 *
 *  If the -a/--absolute flag is specified, an absolute path will be used for
 *  the inserted link/script tag.
 */
module.exports = exports = function(libraryPath, filePath, env) {
  var path;
  var tab = '';
  
  // use an absolute or relative path to the library based on user input
  if (!env.absolute) {
    var libraryDir = pathLib.dirname(libraryPath);
    var fileDir = pathLib.dirname(filePath);

    // relative path between directories
    path = pathLib.relative(fileDir, libraryDir);
    if (path) {
      path = path + '/';
    }
    
    path += pathLib.basename(libraryPath);
  } else {
    path = pathLib.resolve(libraryPath);
  }

  // store the tab character(s) based on the given tab length
  if (env.tabLength === -1) {
    tab = '\t';
  } else {
    for (var i = 0; i < env.tabLength; i++) {
      tab += ' ';
    }
  }

  utils.readFile(filePath)
    .then(function(contents) {
      var fileExtension = utils.getExtension(filePath);
      var newContents;

      if (fileExtension === 'jade') {
        newContents = addLibraryToJade(path, contents, tab, env.head);
      } else {
        newContents = addLibraryToHTML(path, contents, tab, env.head);
      }

      if (contents !== newContents) {
        utils.writeFile(filePath, newContents)
          .then(function() {
            console.log('Added ' + libraryPath + ' to ' + filePath +
                        ' successfully.');
          });
    }
    })
    .end();
};

/**
 * Function: addLibraryToJade
 * --------------------------
 * Adds the given library path to the provided Jade. If the path ends in .css
 * a link tag is added to the header of the Jade. If the path ends in .js, a
 * script tag is added to the footer of the Jade. If jsToHead is true, a script
 * tag will be added to the header instead.
 *
 * @param path - the path to the library file
 * @param jade - the Jade to add the library to
 * @param tab - a string that represents a tab in this document
 * @param jsToHead - whether to put JavaScript in the head tag
 *
 * @return the new Jade
 */
function addLibraryToJade(path, jade, tab, jsToHead) {
  var libraryExtension = utils.getExtension(path);
  var appendToTag = 'head';
  var tag;

  // find what and where to insert the link/script tag
  if (libraryExtension === 'css') {
    tag = "link(rel='stylesheet', href='" + path + "')";
  } else {
    tag = "script(src='" + path + "')";
    if (!jsToHead) {
      appendToTag = 'body';
    }
  }

  // match whitespace prior to the head/body tag to accurately indent the
  // inserted link/script tag
  var rTarget = new RegExp('^([ \t]*)' + appendToTag + '\\b', 'im');
  if (!rTarget.test(jade)) {
    console.error('Could not find ' + appendToTag + ' tag. Please' +
                  ' insert ' + tag + ' yourself.');
    return jade;
  }

  // extract the prior whitespace
  var matches = rTarget.exec(jade);
  var priorWhitespace = matches[1];

  // start searching from the index after the head/body tag
  var nextIndex = matches.index + matches[0].length;
  var searchStr = '\n';

  var insertAt;
  nextIndex = jade.indexOf(searchStr, nextIndex);

  // look for where the head/body tag ends
  while (nextIndex !== -1) {
    insertAt = nextIndex;
    nextIndex += searchStr.length;

    // If the same priorWhitespace is not found at the beginning of the next
    // line, then the tag has ended. In like manner, if the same whitespace is
    // found, but the next character is not whitespace, then some other sibling
    // tag has begun, thereby ending this tag as well.
    if (jade.indexOf(priorWhitespace, nextIndex) !== nextIndex ||
        rNotWhitespace.test(jade[nextIndex + priorWhitespace.length])) {
      break;
    }

    nextIndex = jade.indexOf(searchStr, nextIndex);
  }

  if (!insertAt) {
    // no newline at the end of the head/body tag; append link/script at end
    jade = jade + '\n' + priorWhitespace + tab + tag + '\n';
  } else {
    // append link/script at insertion point
    jade = jade.substring(0, insertAt) + '\n' + priorWhitespace + tab + tag +
      jade.substring(insertAt, jade.length);
  }

  return jade;
}

/**
 * Function: addLibraryToHTML
 * --------------------------
 * Adds the given library path to the provided Jade. If the path ends in .css
 * a link tag is added to the header of the Jade. If the path ends in .js, a
 * script tag is added to the footer of the Jade. If jsToHead is true, a script
 * tag will be added to the header instead.
 *
 * @param path - the path to the library file
 * @param html - the HTML to add the library to
 * @param tab - a string that represents a tab in this document
 * @param jsToHead - whether to put JavaScript in the head tag
 *
 * @return the new HTML
 */
function addLibraryToHTML(path, html, tab, jsToHead) {
  var libraryExtension = utils.getExtension(path);
  var appendToTag = 'head';
  var tag;

  // find what and where to insert the link/script tag
  if (libraryExtension === 'css') {
    tag = '<link rel="stylesheet" href="' + path + '" />';
  } else {
    tag = '<script src="' + path + '"></script>';
    if (!jsToHead) {
      appendToTag = 'body';
    }
  }

  // first try to match whitespace prior to the end head/body tag to
  // accurately determine how far to indent the inserted tag
  var rTarget = new RegExp('^([ \t]*)</' + appendToTag + '>', 'im');
  if (!rTarget.test(html)) {
    // if this doesn't work, resort to just matching the end tag
    rTarget = new RegExp('</' + appendToTag + '>', 'i');

    if (!rTarget.test(html)) {
      console.error('Could not find ' + appendToTag + ' tag. Please' +
                    ' insert ' + tag + ' yourself.');
      return html;
    }
  }

  return html.replace(rTarget, function(fullMatch, matches) {
    if (matches[1]) {
      // the regex matched whitespace prior to the end head/body tag;
      // prepend this to the inserted tag along with a tab
      return matches[1] + tab + tag + '\n' + fullMatch;
    } else {
      return tab + tag + '\n' + fullMatch;
    }
  });
}
