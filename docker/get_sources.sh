#!/bin/sh

# Used as part of docker build.
# If not specified to use local sources, the repository will be cloned.

if [ "$USE_LOCAL_SOURCES" = "true" ]; then
    echo "Using local sources"
else
    echo "Cloning sources"
    rm -rf ./focalboard
    git clone https://github.com/mattermost/focalboard
fi
