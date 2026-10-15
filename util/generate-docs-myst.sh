#!/bin/bash

tmp_log_file=$(mktemp)
rm -rf docs

# Generate MyST documentation (docs/api.md) using jsdoc with our own template.
# Like generate-docs.sh, we can't rely on the exit code since jsdoc doesn't support
# import() syntax for types, so we check the remaining output for other errors instead.
# The template's own "Wrote ..." line is not an error.
./node_modules/jsdoc/jsdoc.js --destination docs --recurse -t ./util/jsdoc-myst-template -c ./util/jsdoc-myst.conf -a public,package,undefined 2>&1 | grep -v -e 'import(' -e '^Wrote ' > $tmp_log_file

errors=$(wc -l $tmp_log_file | awk '{print $1}')

if [ $errors -gt 0 ]; then
  echo "Errors found in documentation generation"
  cat $tmp_log_file
  exit 1
fi

if [ ! -s docs/api.md ]; then
  echo "docs/api.md was not generated"
  exit 1
fi
