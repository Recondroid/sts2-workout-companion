#!/bin/bash
# Slay the Spire 2 Workout Companion -- macOS launcher.
# Double-click in Finder to start. Needs Python 3 installed.
# First time: you may need to run `chmod +x start.command` once.
cd "$(dirname "$0")" || exit 1
exec python3 serve.py
