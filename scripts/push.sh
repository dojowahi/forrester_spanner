#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Pushing changes to Git and GitHub ==="

# Check if a commit message was provided
if [ -z "$1" ]; then
    read -p "Enter commit message: " COMMIT_MESSAGE
else
    COMMIT_MESSAGE="$1"
fi

if [ -z "$COMMIT_MESSAGE" ]; then
    echo "Error: Commit message cannot be empty."
    exit 1
fi

# Add all changes
echo "-> Adding changes..."
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "-> No changes to commit. Working tree is clean."
    exit 0
fi

# Commit changes
echo "-> Committing changes with message: '$COMMIT_MESSAGE'"
git commit -m "$COMMIT_MESSAGE"

# Push to the current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "-> Pushing to origin/$CURRENT_BRANCH..."
git push origin "$CURRENT_BRANCH"

echo "=== Successfully pushed to GitHub! ==="
