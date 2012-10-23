
1.0.1 / 2012-10-22 
==================

  * Update consolidate-build to allow for CoffeeScript compiler options.
  * Add output option to compile command.
  * Make compiler options extension-specific.
  * Correct stale comment.
  * Fix deferred bug in determining which files to compile.
  * Add line breaks to README.

1.0.0 / 2012-10-04 
==================

  * Use auto-discovery mode for socket connection to allow live reloading on mobile.
  * Add options for compilation by means of the compilerOptions parameter. Addresses issue #21.
  * Enable configuration files for commands. These are located at `.nf/[command].(json|yml|yaml)` anywhere in the directory tree.
  * Display compile dependencies using a relative path.
  * Make compilation errors more descriptive. Addresses issue #19.
  * When run with no arguments, fix bug in printing help due to new commander dependency. Addresses issue #18.
  * Switch commander dependency from git repository to package in npm.
  * Disable socket.io logging. Addresses issue #17.
  * Change generic file names in tests to expected and actual for clarity.
  * Make line endings consistent for tests.
  * Cut down on size of fetch resources. Switch to node-zip library.
  * Reduce size of resources to speed up tests and allow for displaying differences. Addresses issue #16.
  * Make versions more flexible, especially for development dependencies. Addresses issue #15.
  * Replace Makefile with npm commands for more OS compatibility.
  * Add tests for compile watch mode.
  * Split compile serve and live mode to separate serve command. Add zombie.js tests for live mode.

0.1.1 / 2012-08-19 
==================

  * Make index.html short URLs end with a slash, as they represent directories.
  * Make compile live mode work with index.html files. Addresses issue #10.

0.1.0 / 2012-08-17 
==================

  * Use [consolidate-build](https://github.com/ForbesLindesay/consolidate-build) to support a variety of templating/built languages. Addresses issue #6.

0.0.8 / 2012-08-15 
==================

  * Add markdown support information to the README. Addresses issue #9.
  * Serve index.html files when visiting the containing directory for compile serve/live mode. Addresses issue #8.
  * Make nodefront print help when run with no arguments. Rename compile -h option to not conflict with help. Addresses issue #7.

0.0.7 / 2012-08-14 
==================

  * Fix bug that prevents setting port number for compile live mode. Addresses issue #5.
  * Update preferred method of upgrading nodefront in README.

0.0.6 / 2012-08-11 
==================

  * Add hostname option to compile command.

0.0.5 / 2012-08-09 
==================

  * Catch compilation errors to prevent crashes. Addresses issue #2.

0.0.4 / 2012-08-08 
==================

  * Add support to compile CoffeeScript. Addresses issue #1.
  * Display cleaner relative paths.
