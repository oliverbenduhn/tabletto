#!/bin/sh
# Secure entrypoint: ensure data directory is writable by appuser, then drop privileges.

set -e

# Ensure /app/data directory is owned by appuser for database initialization
mkdir -p /app/data
chown -R appuser:appgroup /app/data

# Drop privileges and exec the application as appuser
exec gosu appuser "$@"
