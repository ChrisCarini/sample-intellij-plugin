#!/bin/bash

rsync -rz --exclude='.git' ./.github/actions/gh-test-ij-release-update-action/ ~/GitHub/jetbrains/gh-test-ij-release-update-action