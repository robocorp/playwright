#!/usr/bin/env bash
set -e
set -x

SOURCE_ZIP_PATH=$1
DESTINATION_ROOT_PATH=$2
DESTINATION_PKG_PATH="$DESTINATION_ROOT_PATH/driver/package"

DESTINATION_PKG_LIB_FOLDER="$DESTINATION_PKG_PATH/lib/"
DESTINATION_PKG_BROWSER_FILE="$DESTINATION_PKG_PATH/browsers.json"

echo "Source ZIP path: $SOURCE_ZIP_PATH"
echo "Destination path: $DESTINATION_ROOT_PATH"


# preexisting checks
if [ -n "$(ls -A "$SOURCE_ZIP_PATH" 2>/dev/null)" ]
then
  echo "= Source ZIP path exists"
else
  echo "! ERROR: ZIP file not found"
  exit 1
fi
if [ -n "$(ls -A "$DESTINATION_ROOT_PATH" 2>/dev/null)" ]
then
  echo "= Destination path exists"
else
  echo "! ERROR: Destination path not found"
  exit 1
fi
if [ -n "$(ls -A "$DESTINATION_PKG_PATH" 2>/dev/null)" ]
then
  echo "= Destination package path exists"
else
  echo "! ERROR: Destination package path not found"
  exit 1
fi
if [ -n "$(ls -A "$DESTINATION_PKG_LIB_FOLDER" 2>/dev/null)" ]
then
  echo "= Destination package lib path exists"
else
  echo "! ERROR: Destination package lib path not found"
  exit 1
fi
if [ -n "$(ls -A "$DESTINATION_PKG_BROWSER_FILE" 2>/dev/null)" ]
then
  echo "= Destination package browser path exists"
else
  echo "! ERROR: Destination package browser path not found"
  exit 1
fi
echo "= Validation succeeded"

# unzip in temp folder
TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'robocorp_temp_dir')
TEMP_LIB_FOLDER="$TEMP_DIR/lib/"
TEMP_LIB_BROWSER="$TEMP_DIR/browsers.json"

echo "= Unzipping patch..."
unzip "$SOURCE_ZIP_PATH" -d "$TEMP_DIR"

if [ -n "$(ls -A "$TEMP_LIB_FOLDER" 2>/dev/null)" ]
then
  echo "= Patch does contain lib"
else
  echo "! ERROR: Patch does not contain lib"
  exit 1
fi
if [ -n "$(ls -A "$TEMP_LIB_BROWSER" 2>/dev/null)" ]
then
  echo "= Patch does contain browsers.json"
else
  echo "! ERROR: Patch does not contain browsers.json"
  exit 1
fi

echo "= Applying patch..."
if ! command -v rsync &> /dev/null
then
  echo "! ERROR: rsync could not be found"
  echo "= Using cp to patch"
  cp -R "$TEMP_LIB_FOLDER" "$DESTINATION_PKG_LIB_FOLDER"
  cp -R "$TEMP_LIB_BROWSER" "$DESTINATION_PKG_BROWSER_FILE"
  echo "= Patch was applied!"
else
  echo "= Using rsync to patch"
  rsync -aP "$TEMP_LIB_FOLDER" "$DESTINATION_PKG_LIB_FOLDER"
  rsync -aP "$TEMP_LIB_BROWSER" "$DESTINATION_PKG_BROWSER_FILE"
  echo "= Patch was applied!"
fi


echo "= Cleaning up..."
rm -rf "$TEMP_DIR"
echo "= DONE"
