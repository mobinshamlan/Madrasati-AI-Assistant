#!/usr/bin/env bash
# Builds the Railway upload in an empty folder: the backend and the shared dataset, never a secret.
# The dataset lives in supabase/data so that Supabase and the backend read one copy.
# Usage: scripts/stage-backend.sh <empty-folder>
set -euo pipefail

target="${1:?Usage: scripts/stage-backend.sh <empty-folder>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$target"
if [ -n "$(ls -A "$target")" ]; then
  echo "Refusing to stage into a folder that is not empty: $target" >&2
  exit 1
fi

source="$root/Test_AI_Agent_Upload"
cp "$source/Dockerfile" "$source/.dockerignore" "$source/railway.json" "$source/requirements.txt" "$target/"
cp -R "$source/backend" "$target/backend"
find "$target" -type d -name __pycache__ -prune -exec rm -rf {} +
find "$target" -name '.env*' ! -name .dockerignore -delete
mkdir -p "$target/backend/data"
cp "$root/supabase/data/madrasati-dataset.json" "$target/backend/data/madrasati-dataset.json"
echo "Staged the backend in $target"
