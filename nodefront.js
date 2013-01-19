#!/usr/bin/env node
var program = require('commander');
var packageConf = require('nconf');
var config = require('commander-config');

// access package.json for version number
packageConf.file({ file: __dirname + '/package.json' });

// nodefront program
program
  .version(packageConf.get('version'))
  .usage('[command]');

// compile files
program
  .command('compile')
  .description('Compiles *.jade and *.styl(us) files.')
  .option('-r, --recursive', 'Recurse through directories.')
  .option('-w, --watch', 'Recompile files upon modification. Intelligently' +
    ' recompile dependencies.')
  .option('-o, --output <directory>', 'Put compiled files in the given' +
    ' directory. Defaults to the current directory.', String, '.')
  .action(config.withSettings('.nf/compile', require('./commands/compile')));

// serve files
program
  .command('serve [port] [hostname]')
  .description('Serves files on the given hostname and port, defaulting to' +
               ' localhost:3000.')
  .option('-c, --compile', 'Shortcut to run nodefront compile -w/--watch' +
          ' simultaneously')
  .option('-o, --output <directory>', 'Should be used with the -c/--compile' +
    ' option. Put compiled files in the given directory, passing this to the' +
    ' -o/--output option of the compile command. Defaults to the current' +
    ' directory.', String, '.')
  .option('-l, --live', 'Automatically refreshes the browser upon' +
          ' modification of HTML/CSS/JS files.')
  .action(config.withSettings('.nf/serve', require('./commands/serve')));

// fetch libraries
program
  .command('fetch [library]')
  .description('Fetches <library> for immediate use.')
  .option('-u, --url <url>', 'The URL to fetch the library from.')
  .option('-p, --path <pathRegex>', 'Provides the path to the library in the' +
          ' zip archive specified by the -u/--url <url> parameter. Note' +
          ' that <pathRegex> should be a regular expression.')
  .option('-v, --version <version>', 'Specify the version of the library to' +
          ' fetch.', String, '')
  .option('-o, --output <directory>', 'If provided, the library will be' +
          ' stored as a file in the given directory. Otherwise, it will be' +
          ' added to the current directory.', String, '')
  .option('-t, --type <type>', 'The type of this library, which should also' +
          'be its extension. This defaults to js.', String, 'js')
  .option('-m, --minify', 'Minify the fetched file.')
  .option('-i, --interactive', 'Interactively add a new library and fetch it.')
  .action(config.withSettings('.nf/fetch', require('./commands/fetch')));

// insert CSS/JS libraries into HTML/Jade documents
program
  .command('insert <library> <file>')
  .description('Inserts <library> into <file>. <library> should be a path to' +
               'a CSS/JavaScript library and <file> should be a path to an' +
               'HTML/Jade document.')
  .option('-h, --head', 'Insert the given JS file into the head of the' +
          'document. By default, JS is inserted into the footer.')
  .option('-a, --absolute', 'Use an absolute path for the inserted' +
          'link/script tag instead of a relative one.')
  .option('-t, --tab-length <length>', 'The number of spaces that constitute' +
          ' each tab in the document for insertion purposes. If hard tabs' +
          ' are used, specify -1 for this option. Otherwise, if this is not' +
          ' given, the tab length is assumed to be 4.', Number, 4)
  .option('-d, --delete', 'Delete <library> from <file>.')
  .action(config.withSettings('.nf/insert', require('./commands/insert')));

// minify CSS/JS and optimize images
program
  .command('minify [fileRegex]')
  .description('Minifies all CSS/JS files that match the regular expression' +
               ' <fileRegex>. Can also optimize PNG/JPEG images.')
  .option('-r, --recursive', 'Minifies files that match <fileRegex> in' +
          ' sub-directories. By default, only the current directory is' +
          ' searched')
  .option('-o, --out <file>', 'Stores the minified output in <file>. Include' +
          ' {{ name }} in <file> and it will be replaced with the original' +
          ' file name sans extension. Include {{ extension }} and it will be' +
          " replaced by the original file's extension. By default, this is" +
          " '{{ name }}.min.{{ extension }}'", String, '{{ name }}.min.' +
          '{{ extension }}')
  .option('-w, --overwrite', 'Shortcut for -o {{ name }}.{{ extension }}.' +
          ' Overwrites the files that match <fileRegex> with their minified' +
          ' versions.')
  .option('-t, --type <type>', 'Files that match <fileRegex> will be treated' +
          " as if they are of type <type>, where <type> is 'js', 'css'," +
          " 'jpg', 'jpeg', or 'png'. The appropriate minifier will then be" +
          ' used. Normally, types are determined by the extension of files.')
  .option('-c, --css', 'Shortcut to minify all CSS files.')
  .option('-j, --js', 'Shortcut to minify all JS files.')
  .option('-i, --images', 'Shortcut to optimize all JPEG/PNG files.')
  .option('-p, --plain', 'Switch to plain text mode, where [fileRegex] is no' +
          ' longer a regular expression, but just the path to a file.')
  .action(config.withSettings('.nf/minify', require('./commands/minify')));

program.parse(process.argv);

if (process.argv.length === 2) {
  // no arguments were provided; output the help
  process.stdout.write(program.helpInformation());
  program.emit('--help');
}
