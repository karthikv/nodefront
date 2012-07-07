#!/usr/bin/env node
var program = require('commander');
var packageConf = require('nconf');

packageConf.file({ file: __dirname + '/package.json' });

// nodefront program
program
  .version(packageConf.get('version'))
  .usage('[command]');

program
  .command('compile')
  .description('Compiles *.jade and *.styl(us) files.')
  .option('-r, --recursive', 'Recurse through directories.')
  .option('-w, --watch', 'Recompile files upon modification. Intelligently' +
    ' recompile dependencies.')
  .action(require('./commands/compile'));

program.parse(process.argv);
