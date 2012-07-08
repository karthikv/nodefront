#!/usr/bin/env node
var program = require('commander');
var packageConf = require('nconf');

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
  .option('-s, --serve [port]', 'Serve files on localhost at the given port' +
    ' number, which defaults to 3000.', Number)
  .option('-l, --live [port]', 'Implies -w/--watch and -s/--serve [port].' +
    ' Serves files on localhost and automatically refreshes browser upon' +
    ' modification of HTML/CSS/JS files.', Number)
  .action(require('./commands/compile'));

program.parse(process.argv);
