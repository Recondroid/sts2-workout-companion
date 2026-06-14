#!/bin/bash
# Slay the Spire 2 Workout Companion -- Linux launcher.
# Run with: ./start.sh   (you may need `chmod +x start.sh` once). Needs Python 3.
cd "$(dirname "$0")" || exit 1
exec python3 serve.py
