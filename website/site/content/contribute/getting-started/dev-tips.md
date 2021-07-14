---
title: "Developer Tips & Tricks"
date: 2021-02-03T00:08:00-00:00
weight: 1
subsection: Getting Started
---

## Install pre-reqs

Check that you have recent versions of the basic dependencies installed:
* [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
    * On Windows, install [Git for Windows](https://gitforwindows.org/) and use the git-bash terminal shell
* [Go](https://golang.org/doc/install)
* [Node](https://nodejs.org/en/download/) (v10+) and [npm](https://www.npmjs.com/get-npm)

On Windows:
* Install [Mingw64](https://chocolatey.org/packages/mingw) via [Chocolatey](https://chocolatey.org/)

On Mac, to build the Mac app:
* Install [Xcode](https://apps.apple.com/us/app/xcode/id497799835?mt=12) (v12+)
* Install the Xcode commandline tools, via the IDE or run `xcode-select --install`

On Linux, to build the Linux app:
* `sudo apt-get install libgtk-3-dev`
* `sudo apt-get install libwebkit2gtk-4.0-dev`

## Clone the project source code

Clone the [GitHub repo here](https://github.com/mattermost/focalboard).

## VSCode Setup

Here's a recommended dev-test loop using VSCode:
* Open a bash terminal window to the project folder
* Run `make prebuild` to npm install
    * Do this again when dependencies change in `webapp/package.json`
* Run `cd webapp && npm run watchdev`
    * This will auto-build the webapp on file changes
* Open VSCode
    * Install the [Go](https://marketplace.visualstudio.com/items?itemName=golang.Go) and [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) VSCode extensions if you haven't already
* Hit F5 and select `Go: Launch Server`
    * Or, press `Cmd+P` and type `debug <space>` and pick the option
* Open a browser to `http://localhost:8000`
    * The port is configured in `config.json`

You can now edit the webapp code and refresh the browser to see your changes.

## Debugging the web app

You can use your favorite browser to debug the webapp code. With Chrome, open the dev tools with `Cmd+Alt+I` (`Ctrl+Alt+I` in Windows).
* `npm run watchdev` builds the dev package, which includes source maps from js to typescript
* In the Chrome devtools source tab, press `Cmd+P` to jump to a source file

As a starting point, add a breakpoint to the `render()` function in `BoardPage.tsx`, then refresh the browser to walk through page rendering.

## Debugging the server

Debug the Go code in VSCode. This is set up automatically when you launch the server from there.

To start, add a breakpoint to `handleGetBlocks()` in `server/api/api.go`, then refresh the browser to see how data is retrieved.

## Localization / Internationalization / Translation

We use `i18n` to localize the web app. Localized string generally use `intl.formatMessage`.

When adding or modifying localized strings, run `npm run i18n-extract` in `webapp` to rebuild `webapp/i18n/en.json`.

Translated strings are stored in other json files under `webapp/i18n`, e.g. `es.json` for Spanish.

## Database

By default, data is stored in a sqlite datebase `focalboard.db`. You can view and edit this directly using `sqlite3 focalboard.db` from bash.

## Unit tests

Before checking-in commits, run: `make ci`, which is simlar to the ci.yml workflow and includes:
* Server unit tests: `make server-test`
* Webapp eslint: `cd webapp; npm run check`
* Webapp unit tests: `cd webapp; npm run test`
* Webapp UI tests: `cd webapp; npm run cypress:ci`

glhf! :)
