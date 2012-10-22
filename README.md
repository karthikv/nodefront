# Nodefront [![Build Status](https://secure.travis-ci.org/karthikv/nodefront.png)](http://travis-ci.org/karthikv/nodefront)

To see a styled version of the documentation below, please visit [nodefront's website](http://karthikv.github.com/nodefront).

## Overview

Nodefront is a node.js-powered command-line utility that speeds up front-end development.

## Installation

Installation is simple with npm:

```bash
$ npm install -g nodefront
```

## Upgrading

Upgrading nodefront should be done by reinstalling, like so:

```bash
$ npm uninstall -g nodefront
$ npm install -g nodefront
```

It is not recommended to use `npm update nodefront` due to a [known bug](https://github.com/isaacs/npm/issues/2390) that prevents it from adding new dependencies correctly.

## Introductory Screencast

Before diving into the documentation, you may view a [screencast that introduces some of nodefront's key features on Vimeo](https://vimeo.com/46197434).

## Command Summary

Compile: `nodefront compile` - Compiles a variety of templating and built languages (see compile command below), including, by default, Jade, Stylus, and CoffeeScript. Can compile upon modification.

Serve: `nodefront serve` - Serve files on localhost. Automatically refresh the browser/styles when files are changed.

Fetch: `nodefront fetch` - Automatically fetches CSS/JS libraries for use in your project. Provides an interactive mode to add new libraries.

Insert: `nodefront insert` - Inserts CSS/JS libraries directly into your HTML or Jade files.

Minify: `nodefront minify` - Minifies CSS and JS files. Can also optimize JPG and PNG images.

## Compile Command
### Usage

```bash
$ nodefront compile [options]
```

The compile command, by default, will look for all Jade (\*.jade), Stylus (\*.styl, \*.stylus), and CoffeeScript (\*.coffee) files in the current directory without recursing (see the recursive option) and compile them to their HTML, CSS, and JS counterparts, simply replacing the extension of the originally-named file.

This command, however, is not limited to only these three file types. Because nodefront uses [consolidate-build](https://github.com/ForbesLindesay/consolidate-build), all of the following templating and built languages are supported:

- [coffee-script](https://github.com/jashkenas/coffee-script) - [website](http://coffeescript.org/)
- [dust](https://github.com/akdubya/dustjs) - [website](http://akdubya.github.com/dustjs/)
- [eco](https://github.com/sstephenson/eco)
- [ejs](https://github.com/visionmedia/ejs)
- [haml](https://github.com/visionmedia/haml.js) - [website](http://haml-lang.com/)
- [haml-coffee](https://github.com/9elements/haml-coffee) - [website](http://haml-lang.com/)
- [handlebars](https://github.com/wycats/handlebars.js/) - [website](http://handlebarsjs.com/)
- [hogan](https://github.com/twitter/hogan.js) - [website](http://twitter.github.com/hogan.js/)
- [jade](https://github.com/visionmedia/jade) - [website](http://jade-lang.com/)
- [jazz](https://github.com/shinetech/jazz)
- [jqtpl](https://github.com/kof/node-jqtpl) - [website](http://api.jquery.com/category/plugins/templates/)
- [JUST](https://github.com/baryshev/just)
- [less](https://github.com/cloudhead/less.js) - [website](http://lesscss.org)
- [liquor](https://github.com/chjj/liquor)
- [markdown](http://daringfireball.net/projects/markdown/)
- [mustache](https://github.com/janl/mustache.js)
- [QEJS](https://github.com/jepso/QEJS)
- [sass](https://github.com/visionmedia/sass.js) - [website](http://sass-lang.com/)
- [stylus](https://github.com/learnboost/stylus) - [website](http://learnboost.github.com/stylus/)
- [swig](https://github.com/paularmstrong/swig) - [website](http://paularmstrong.github.com/swig/)
- [underscore](https://github.com/documentcloud/underscore) - [website](http://documentcloud.github.com/underscore/)
- [walrus](https://github.com/jeremyruppel/walrus) - [website](http://documentup.com/jeremyruppel/walrus/)
- [whiskers](https://github.com/gsf/whiskers.js/tree/)

To employ any of the above languages other than the three defaults, you'll need to install their respective engines. For example, if you'd like to use ejs, you'll need to run:

```bash
npm install -g ejs
```

For Markdown specifically, you have the option of installing [marked](https://github.com/chjj/marked), [discount](https://github.com/visionmedia/node-discount), [markdown-js](https://github.com/Gozala/markdown-js) or [markdown](https://github.com/evilstreak/markdown-js). If more than one of these are installed, the first in that list will take precedence.

Then, simply create files with the extension corresponding to the engine you're using (e.g. '.ejs' for ejs files) and nodefront will automatically compile them when you run the compile command.

### Example
If the directory structure initially looks like:

    .
    |_ index.jade
    |_ styles.styl
    `_ script.coffee

After running `nodefront compile`, `index.jade` will be compiled to `index.html`, `styles.styl` will be compiled to `styles.css`, and `script.coffee` will be compiled to `script.js`, resulting in the following new directory structure:

    .
    |_ index.jade
    |_ index.html
    |_ styles.styl
    |_ styles.css
    |_ script.coffee
    `_ script.js

### Options
Help: `nodefront compile -h/--help` outputs usage information about the compile command.

Recursive: `nodefront compile -r/--recursive` recurses through sub-directories instead of only compiling files in the current directory.

Watch: `nodefront compile -w/--watch` watches all files that can be compiled in the current directory (and subdirectories if the recursive option is specified) and recompiles them upon modification. `watch` is dependency aware, meaning that if `index.jade` extends/includes `layout.jade`, when `layout.jade` is modified, both `layout.jade` and `index.jade` will be recompiled. This same awareness is present for Stylus files as well.

Output: `nodefront compile -o/--output [directory]` outputs all compiled files into the given output directory. If not provided, this defaults to the current directory.

### Markdown Support
If you'd like markdown support for Jade, simply install the [marked](https://github.com/chjj/marked) library, like so:

```bash
$ npm install -g marked
```

Jade should automatically interface with it.

### Configuration Files
Language compilers often come with a variety of options. For example, Jade has the option of compressing HTML upon compilation. Nodefront allows you to set these options via configuration files. To do so, simply create a `.nf` directory anywhere in your project tree. This means that `.nf` can be present directly in your project directory or in any of its parent directories. Then, add a `compile.json` or `compile.yml` file with a `compilerOptions` map. Each key should be a file extension and the value should be map of options to pass to the compiler for that extension. For example, to tell Jade to output pretty HTML instead of compressing it, you can use the following `.nf/compile.json` file:

```json
{
    "compilerOptions": {
        "jade": { 
            "pretty": true
        }
    }
}
```

The YAML equivalent, `.nf/compile.yml`, would look like:

```yml
compilerOptions:
    jade:
        pretty: true
```

## Serve Command
### Usage

```bash
$ nodefront serve [options] [port] [hostname]
```

The serve command will serve all static files in the current directory and subdirectories on a local Node.js server. The current directory will act as the effective root of the server. Files will be accessible by the URL http://[hostname]:[port]/[path], where [path] is the path to the file relative to the current directory. [hostname] and [port] are provided as explicit parameters on the command-line and default to localhost and 3000, respectively.

### Example
If the directory structure looks like:

    .
    |_ index.html
    |_ css
      `_ styles.css
    |_ js
      `_ script.js

Running `nodefront serve` in the directory with no options would allow you to access the three files above using the following URLs:

http://localhost:3000/index.html would serve ./index.html  
http://localhost:3000/css/styles.css would serve ./css/styles.css  
http://localhost:3000/css/script.js would serve ./js/script.js

### Options
Compile: `nodefront serve -c/--compile` will run `nodefront compile -w/--watch` simultaneously. This allows you to modify files that need to be compiled and immediately see the updates in your browser.

Live: `nodefront serve -l/--live` will monitor each HTML page that is served to the browser and all of its CSS/JS dependencies. If the page's source itself or one of its scripts changes, the browser will automatically refresh. If a CSS stylesheet is modified, it will be reloaded without refreshing via a cache-busting query string. This allows for live development with immediate feedback and circumvents the need to keep reloading the browser manually.

For those who are interested in the more technical aspects of live mode, the server that is created automatically injects web socket code, courtesy of socket.io, into HTML pages. This allows for communication between the client and the Node.js server. Whenever a file is modified, the server notifies the client via the established socket connection. The client then assesses whether this file affects the current page and takes appropriate actions.

## Fetch Command
### Usage

```bash
$ nodefront fetch [library] [options]
```

The fetch command will download the given CSS/JS library, [library], from the web and add it to the current directory. Nodefront is already aware of many of the most popular CSS/JS libraries, but can easily be configured to fetch lesser-known ones.

### Example
To fetch the latest version of jQuery, simply run:

```bash
$ nodefront fetch jquery
```

jQuery 1.7.2 (as of 6/19/12) will then be added to the current directory. If, for instance, you'd like to fetch version 1.5, simply use the version option, specified by `-v` or `--version`:

```bash
$ nodefront fetch jquery -v 1.5
```

jQuery 1.5 should then be downloaded into the current directory.

### Options
Help: `nodefront fetch -h/--help` outputs usage information about the compile command.

Type: `nodefront fetch [library] -t/--type [type]` will set the type, or extension, of the given library, [library]. When the library has finished downloading, it will then be named [library]-[version].\[type\]. Note that the type defaults to js if this option is not given.

Output: `nodefront fetch [library] -o/--output [directory]` downloads the given library and stores the resultant file (see type option above), in the given directory, [directory].

Version: `nodefront fetch [library] -v/--version [version]` downloads the given library at the provided version number, [version], and saves it to [library]-[version].\[type\] (see type option above).

Interactive: `nodefront fetch [library] -i/--interactive` enables interactive mode, where you'll be provided with numerous dialogs that fully explain the process of adding a new library. You can alternatively specify all the configuration parameters necessary by using the command-line (see options below). Note that, if necessary, you can mix and match as well, specifying the URL parameter while also going into interactive mode to get some help setting the path.

URL: `nodefront fetch [library] -u/--url [url]` will fetch the library file at the given URL, [url], and add it to the current directory with the name [library]-[version].\[type\] (see version/type options above). To make this flexible for different versions of the library, simply add the parameter `{{ version }}` where the version should be inserted in the URL. Then, the version parameter (see above) will determine what value this gets replaced with. Note that, if you specify the URL for a library, all configuration options are automatically saved, meaning that you can fetch the library again at any time simply by running `nodefront fetch [library]`. If you ever need to update the configuration options again, specify the URL once more.

Path: `nodefront fetch [library] -p/--path [pathRegex]` requires the URL parameter to be provided (see above). It then assumes that the [url] points to a zip file, extracts all files within it, and finds the first one to match the regular expression [pathRegex]. This file will be considered the library you were looking for and is then downloaded.

Minify: `nodefront fetch [library] -m/--minify` will fetch the given library and minify it upon download. Note that both CSS and JS libraries can be minified.

## Insert Command
### Usage

```bash
$ nodefront insert [libraryPath] [file] [options]
```

The insert command will insert the CSS or JS library, given by the path [libraryPath], into the HTML or Jade file specified by [file] as either a link or script tag. If [libraryPath] ends in '.css', a link tag will be appended to the head of the document. In like manner, if [libraryPath] ends in '.js', a script tag will be inserted in the footer prior to the end of the body (see head option for inserting into the head).

### Examples
To insert a script tag containing jquery at the end of index.html, run:

```bash
$ nodefront insert jquery-1.7.2.js index.html
```

If, instead, you would like the script tag to be appended to the head tag, simply specify the head option, specified by `-h` or `--head`:

```bash
$ nodefront insert jquery-1.7.2.js index.html -h
```

Both of these will insert the tag `<script src="jquery-1.7.2.js"></script>` into index.html. For jade files, nodefront will insert `script(src='jquery-1.7.2.js')` instead. Note that nodefront will find the relative path between [libraryPath] and [file] and use that as the src attribute. If you would like an absolute path instead, use the absolute option, specified by `-a` or `--absolute`.

```bash
$ nodefront insert jquery-1.7.2.js index.html -a
```

To remove `jquery-1.7.2.js` from a file, add the delete option, specified by `-d` or `--delete`.

```bash
$ nodefront insert jquery-1.7.2.js index.html -ad
```

Make sure to maintain the absolute option if the original insertion used an absolute path.

### Options
Help: `nodefront insert --help` outputs usage information about the insert command.

Head: `nodefront insert [libraryPath] [file] -h/--head` will append the given library to the head of the document. By default, CSS libraries are added to the head, as they cannot be added elsewhere, and JS libraries are added prior to the end body tag.

Absolute: `nodefront insert [libraryPath] [file] -a/--absolute` will use the absolute path of the given library, [libraryPath], as the value of the src/href attribute to the script/link tag that is inserted. By default, a relative path is used.

Tab Length: `nodefront insert [libraryPath] [file] -t/--tab-length [length]` will use the provided tab length, [length], when inserting the script/link tag. By default, the tab length is 4, representing four spaces. If you would prefer hard tabs (`'\t'` characters), simply specify -1 as the tab length.

Delete: `nodefront insert [libraryPath] [file] -d` will delete the library from the given file instead of inserting it. Make sure to maintain the absolute option (see above) if the original insertion used an absolute path for the src/href attribute.

## Minify Command
### Usage

```bash
$ nodefront minify [fileRegex] [options]
```

The minify command finds all file paths in the current directory, without recursing (see the recursive option), that match the given fileRegex. It then minifies the corresponding files, using UglifyJS for JS files, YUI (the JS implementation) for CSS, JPEGtran for JPEG, and OptiPNG for PNG. By default, the output file name is the original file name without its extension followed by '.min.' and the original file name's extension. For example, if the original file name is 'style.css', the new file name is 'style.min.css'.

### Examples
To minify script.js in the current directory into script.min.js, run:

```bash
$ nodefront minify -p script.js
```

The plain option, specified by `-p` or `--plain`, changes [fileRegex] from a regular expression to just a plain text string.

To minify all CSS files in the current directory, simply use the CSS option, `-c` or `-css` with no [fileRegex] parameter:

```bash
$ nodefront minify -c
```

In like manner, the JS option, `-j` or  `--js`, and the images option, `-i` or `--images`, minify JS files and optimize all images, respectively. You can mix and match these options as necessary. To minify all CSS, JS, and image files in the current directory, for example, run:

```bash
$ nodefront minify -cji
```

### Options
Help: `nodefront minify --help` outputs usage information about the minify command.

Recursive: `nodefront minify [fileRegex] -r/--recursive` will minify all file paths in the current directory and in any sub-directories that match the regular expression [fileRegex].

Plain: `nodefront minify [fileRegex] -p/--plain` will change [fileRegex] from being a regular expression to just a normal text string. With this option enabled, you can pinpoint the exact file you would like to minify by setting [fileRegex] to its path.

Type: `nodefront minify [fileRegex] -t/--type [type]` will set the type of all the files that are being minified. Normally, the type of a given file is determined by its extension, with \*.css, \*.js, \*.png, and \*.jpg or \*.jpeg representing CSS, JS, PNG, and JPEG files, respectively. If you would like to minify a file without an extension or with one that does not match these defaults, this option will let you force nodefront to treat it as if it had the extension [type]. For example, running `nodefront minify -p script -t js` would minify script as if it was a JS file even though it lacks a .js extension.

Out: `nodefront minify [fileRegex] -o [file]` will minify all file paths in the current directory that match the regular expression [fileRegex] and put the output in the file named [file]. Include `{{ name }}` in [file] and it will be replaced by the name of the current file being minified without its extension. In like manner, include `{{ extension }}` in [file] and it will be replaced by the extension of the current file being minified. For example, assume you have the following directory structure:

    .
    |_ main-script.js
    `_ main-style.css

If you run `nodefront minify main -o '{{ name }}-minified.{{ extension }}'`, main-script.js will be minified to main-script-minified.js and main-style.css will be minified to main-style-minified.css, leaving you with the following new directory structure:

    .
    |_ main-script.js
    |_ main-script-minified.js
    |_ main-style.css
    `_ main-style-minified.js

This option defaults to `{{ name }}.min.{{ extension }}` if not provided.

Overwrite: `nodefront minify [fileRegex] -w/--overwrite` will overwrite files will their minified versions instead of writing to `{{ name }}.min.{{ extension }}` (see out option). This is a shortcut to specifying `{{ name }}.{{ extension }}` for the out option.

CSS: `nodefront minify -c/-css` will minify all CSS files in the current directory. This is a shortcut to `nodefront minify \.css$`.

JS: `nodefront minify -j/-js` will minify all JS files in the current directory. This is a shortcut to `nodefront minify \.js$`.

Images: `nodefront minify --i/--images` will minify all JPEG and PNG images in the current directory. This is a shortcut to `nodefront minify \.(jpg|jpeg|png)$`.

Note that the last three options can be mix and matched as necessary to, for example, minify all CSS and JS, but no images, like so:

```bash
$ nodefront minify -cj
```

## Contributors
### Karthik Viswanathan - nodefront core developer
- GitHub: [@karthikv](https://github.com/karthikv)
- Twitter: [@karthikvnet](https://twitter.com/karthikvnet)
- Website: [http://karthikv.net](http://karthikv.net)
- Email: me@karthikv.net

### Forbes Lindesay - [consolidate-build](https://github.com/ForbesLindesay/consolidate-build) core developer
- GitHub: [@ForbesLindesay](https://github.com/ForbesLindesay)
- Website: [http://www.jepso.com](http://www.jepso.com)

## Questions?
If you have any questions, comments, concerns, or suggestions, please feel free to create a new issue on [GitHub](https://github.com/karthikv/nodefront/issues) or contact Karthik directly (see contributors section above).

## Inspiration
- [Volo](https://github.com/volojs/volo) - "A JavaScript dependency manager and project creation tool that favors GitHub for the package repository."
- [Yeoman](http://yeoman.io/) - "A robust and opinionated client-side stack, comprised of tools and frameworks that can help developers quickly build beautiful web applications."

## License
(The MIT License)

Copyright (c) 2012 Karthik Viswanathan &lt;me@karthikv.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
