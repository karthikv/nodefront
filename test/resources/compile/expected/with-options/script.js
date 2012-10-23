var fs, path;

fs = require('fs');

path = require('path');

if (require.extensions) {
  require.extensions['.coffee'] = function(module, filename) {
    var content;
    content = compile(stripBOM(fs.readFileSync(filename, 'utf8')), {
      filename: filename
    });
    return module._compile(content, filename);
  };
}
