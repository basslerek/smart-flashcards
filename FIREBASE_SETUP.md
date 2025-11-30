# Firebase Setup - Step by Step

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** (or "Create a project")
3. Enter a project name (e.g., "smart-flashcards")
4. Click **Continue**
5. Disable Google Analytics (not needed) or leave it on - your choice
6. Click **Create project**
7. Wait for it to finish, then click **Continue**

## Step 2: Enable Email/Password Authentication

1. In the left sidebar, click **"Authentication"**
2. Click **"Get started"** button
3. Click on the **"Sign-in method"** tab at the top
4. Find **"Email/Password"** in the list
5. Click on it
6. Toggle the **Enable** switch to ON (first option only, not email link)
7. Click **Save**

## Step 3: Create Firestore Database

1. In the left sidebar, click **"Firestore Database"**
2. Click **"Create database"** button
3. Choose **"Start in production mode"**
4. Click **Next**
5. Choose a location close to you (e.g., us-central, europe-west)
6. Click **Enable**
7. Wait for it to create (takes ~30 seconds)

## Step 4: Set Security Rules

1. You should now see the Firestore Database page
2. Click on the **"Rules"** tab at the top
3. Replace everything with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Users can only access their own data
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. Click **Publish**

## Step 5: Get Your Web App Config

1. Click the **gear icon** (⚙️) next to "Project Overview" in the left sidebar
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** (`</>`) to add a web app
5. Give it a nickname (e.g., "flashcard-web")
6. **Don't** check "Firebase Hosting" (not needed)
7. Click **"Register app"**
8. You'll see a code snippet with `firebaseConfig`
9. **Copy just the config object** - it looks like this:

```json
{
  "apiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:xxxxxxxxxxxxx"
}
```

10. Click **"Continue to console"**

## Step 6: Configure Your App

1. Open `index.html` in your browser
2. Enter your OpenAI API key and click Save
3. Expand **"Configure Firebase (Optional)"**
4. Paste the config JSON you copied
5. Click **"Save Firebase Config"**
6. The page will reload and connect to Firebase

## Done! 🎉

Your flashcards will now sync across all your devices. Open the app on your phone's browser and you'll see the same cards!

## Quick Test

1. Generate some flashcards on your computer
2. Open the same `index.html` on your phone's browser
3. You should see the same flashcards appear automatically

## Troubleshooting

**Can't find the web app config?**
- Go to Project Settings → Scroll to "Your apps"
- If you already created an app, click the config icon (`</>`) next to your app name
- Copy the firebaseConfig object

**Getting permission errors?**
- Make sure you published the security rules in Step 4
- The rules allow each user to only access their own data

**Not syncing?**
- Check browser console (F12) for errors
- Make sure you're online
- Try refreshing the page
