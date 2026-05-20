#!/bin/bash
echo 'Running migrations...'
flask db upgrade
echo 'Starting app...'
gunicorn --bind 0.0.0.0:5000 --workers 3 "run:app"
