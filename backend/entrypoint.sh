#!/bin/bash

echo 'Waiting for database...'
until flask db upgrade; do
  echo 'Migration failed, retrying in 5 seconds...'
  sleep 5
done

echo 'Seeding plans...'
flask seed-plans  

echo 'Starting app...'
gunicorn --bind 0.0.0.0:5000 --workers 3 "run:app"