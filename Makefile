test:
	@./node_modules/.bin/mocha --reporter list

test-fetch:
	@./node_modules/.bin/mocha test/test.fetch.js --reporter list

test-minify:
	@./node_modules/.bin/mocha test/test.minify.js --reporter list

.PHONY: test
