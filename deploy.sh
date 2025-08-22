#!/bin/bash

# Ensure npm and pm2 are in the path
export PATH=$PATH:/usr/local/bin:/usr/bin

# Go to the project directory
cd /var/www/teamwise-api

# Pull the latest changes from GitHub
git pull origin main

# Install dependencies
npm install

# Restart the app using PM2
pm2 restart server.js
