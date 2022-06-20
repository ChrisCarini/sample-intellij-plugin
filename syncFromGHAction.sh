#!/bin/bash

rsync -rz --exclude='.git' ~/GitHub/jetbrains/gh-test-ij-release-update-action/ ./.github/actions/gh-test-ij-release-update-action