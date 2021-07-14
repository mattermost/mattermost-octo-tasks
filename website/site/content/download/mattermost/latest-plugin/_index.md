---
title: "Installing the latest plugin"
date: "2020-12-15T12:01:23-04:00"
section: "Installing the latest plugin"
weight: 1
---

You can install the latest Focalboard plugin, including developer builds, ahead of the official release using the following steps:

## Enable custom plugins in Mattermost

Follow the steps in the [Mattermost admin guide to enable custom plugins](https://docs.mattermost.com/administration/plugins.html#custom-plugins):
1. Manually set `PluginSettings > EnableUploads` to `true` in your `config.json`
2. Restart the Mattermost server

Download `mattermost-plugin-focalboard.tar.gz` from the build or release, e.g. the [Focalboard 0.7.3 release](https://github.com/mattermost/focalboard/releases/tag/v0.7.3).

Then upload the Focalboard plugin:
1. Navigate to **System Console > Plugins > Plugin Management**
2. Select "Choose File" under "Upload Plugin"
3. Select the `mattermost-plugin-focalboard.tar.gz` file
4. Select "Upload"
5. Once uploaded, select "Enable" under the Focalboard plugin to enable it

## Update your web proxy configuration

Follow the [steps here](../#with-nginx) to configure your web proxy (NGINX, Apache, etc.) to complete the setup.
