#!/bin/bash

pushd .github/actions/gh-test-ij-release-update-action/ || exit

npm run build && npm run package

popd && act -j test-gh-test-ij-release-update-action