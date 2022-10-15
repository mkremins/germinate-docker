#!/bin/sh

echo Using Node.js $(node --version)

cd /Germinate && python3 -m http.server 9000 &

cd /Gemini/server && node index.js
