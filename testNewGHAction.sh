#!/bin/bash

pushd .github/actions/gh-test-ij-release-update-action/ || exit

npm run build && npm run package
WAS_BUILD_AND_PACKAGE_SUCCESS=$?

popd || exit

if [[ $WAS_BUILD_AND_PACKAGE_SUCCESS -ne 0 ]]; then
  echo "Building and packaging failure. See above."
  exit 1
fi

echo "Building and packaging successful; running action..."
act -j test-gh-test-ij-release-update-action
