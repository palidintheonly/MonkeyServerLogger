#!/bin/bash
# Script to remove all Replit-related files from GitHub repository

# Step 1: Remove Replit files from Git tracking (but keep them locally)
git rm --cached replit.nix 2>/dev/null || true
git rm --cached .replit 2>/dev/null || true
git rm --cached -r .config 2>/dev/null || true
git rm --cached -r .cache 2>/dev/null || true
git rm --cached -r .upm 2>/dev/null || true

# Step 2: Commit these changes
git commit -m "Remove all Replit-related files and references from repository"

# Step 3: Push to GitHub
git push

echo "Operation completed. Please check your GitHub repository to verify all Replit-related files were removed."