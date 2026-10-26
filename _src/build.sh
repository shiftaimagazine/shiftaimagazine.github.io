#!/bin/sh
# 사이트 전체를 다시 만든다. 저장소 루트에서: sh _src/build.sh
set -e
cd "$(dirname "$0")/.."
python3 -I _src/assemble.py
python3 -I _src/build.py
node _src/prerender.js
