fs               = require 'fs'
path             = require 'path'

if require.extensions
  require.extensions['.coffee'] = (module, filename) ->
    content = compile stripBOM(fs.readFileSync filename, 'utf8'), {filename}
    module._compile content, filename
