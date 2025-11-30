# Deploy to GitHub Pages

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `smart-flashcards` (or whatever you like)
3. Make it **Public** (required for free GitHub Pages)
4. **Don't** initialize with README (you already have files)
5. Click **Create repository**

## Step 2: Push Your Code

Open your terminal in this project folder and run:

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit: Smart flashcard app"

# Add your GitHub repo as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/smart-flashcards.git

# Push to GitHub
git push -u origin main
```

If it says `master` instead of `main`, use:
```bash
git branch -M main
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. Click **Pages** in the left sidebar
4. Under "Source", select **main** branch
5. Keep folder as **/ (root)**
6. Click **Save**
7. Wait 1-2 minutes

## Step 4: Access Your App

Your app will be live at:
```
https://YOUR_USERNAME.github.io/smart-flashcards/
```

GitHub will show you the exact URL on the Pages settings page.

## Step 5: Share on Mobile

- Open that URL on your phone's browser
- Add to home screen for app-like experience:
  - **iPhone**: Safari → Share → Add to Home Screen
  - **Android**: Chrome → Menu → Add to Home Screen

## Updates

Whenever you make changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

GitHub Pages updates automatically in 1-2 minutes!

## Troubleshooting

**Push rejected?**
- Make sure you replaced YOUR_USERNAME with your actual GitHub username
- You might need to authenticate (GitHub will prompt you)

**404 error?**
- Wait a few minutes, GitHub Pages takes time to build
- Check the Pages settings to see if it's still building

**Still not working?**
- Make sure the repo is Public
- Check that `index.html` is in the root folder (not in a subfolder)
