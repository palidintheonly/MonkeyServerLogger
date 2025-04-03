#!/bin/bash
# Script to remove replit.nix from GitHub repository

# Step 1: Remove the file from Git tracking (but keep it locally)
git rm --cached replit.nix

# Step 2: Commit this change
git commit -m "Remove replit.nix from repository"

# Step 3: Push to GitHub
git push

echo "Operation completed. Please check your GitHub repository to verify the file was removed."