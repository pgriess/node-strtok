.PHONY: test

test:
	for f in `ls -1 test/test-*.js` ; do \
		echo ">>> Testing $$f" ; \
		node $$f ; \
	done
