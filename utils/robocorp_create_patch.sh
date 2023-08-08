#!/usr/bin/env bash
set -e
set -x

ZIP_FILE_PATH=$PWD/robocorp_patch.zip

echo "= Cleaning up old build"
rm -rf $ZIP_FILE_PATH || echo "! Removing zip failed"

if [ -n "$(ls -A ../packages/playwright-core/lib/ 2>/dev/null)" ]
then
  echo "= Package lib exists & files are generated"
else
  echo "! ERROR: Lib package is not generated"
  exit 1
fi

if [ -n "$(ls -A ../packages/playwright-core/browsers.json 2>/dev/null)" ]
then
  echo "= Browser configuration exists & files are generated"
else
  echo "! ERROR: Browser configuration is not generated"
  exit 1
fi

echo "= Creating zip..."
pushd ../packages/playwright-core
zip -ruvo $ZIP_FILE_PATH lib/ browsers.json
popd

if [ -n "$(ls -A robocorp_patch.zip 2>/dev/null)" ]
then
  echo "= Patch file created successfully"
else
  echo "! ERROR: Patch zip file not found"
  exit 1
fi

unzip -l robocorp_patch.zip

echo "= DONE"
