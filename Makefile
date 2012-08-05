test:
	@./node_modules/.bin/mocha --reporter list

test-fetch:
	@./node_modules/.bin/mocha test/test.fetch.js --reporter list

test-minify:
	@./node_modules/.bin/mocha test/test.minify.js --reporter list

test-insert:
	@./node_modules/.bin/mocha test/test.insert.js --reporter list

test-compile:
	@./node_modules/.bin/mocha test/test.compile.js --reporter list

.PHONY: test
