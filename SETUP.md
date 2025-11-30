# Smart Flashcards Setup Guide

## Quick Start

1. **Get OpenAI API Key**
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy it (you won't see it again!)

2. **Set up Firebase (Optional but recommended for mobile sync)**
   - Go to https://console.firebase.google.com
   - Create a new project
   - Enable Anonymous Authentication:
     - Go to Authentication → Sign-in method
     - Enable "Anonymous"
   - Create Firestore Database:
     - Go to Firestore Database → Create database
     - Start in "production mode"
     - Choose a location close to you
   - Get your config:
     - Go to Project Settings (gear icon)
     - Scroll to "Your apps" → Web app
     - Click "Add app" or view existing config
     - Copy the firebaseConfig object

3. **Configure the App**
   - Open `index.html` in your browser
   - Paste your OpenAI API key and save
   - (Optional) Expand "Configure Firebase" and paste your config JSON

4. **Start Learning!**
   - Paste any text (article, notes, etc.)
   - Click "Generate Flashcards"
   - Start your quiz when cards are ready

## Features

- **AI-Powered**: Automatically generates flashcards from any text
- **Spaced Repetition**: Uses SM-2 algorithm to optimize learning
- **Adaptive Difficulty**: Tracks what you forget and adjusts
- **Mobile-Friendly**: Works on any device with a browser
- **Cloud Sync**: Firebase keeps your cards synced across devices
- **Privacy**: Your API key and data stay secure

## Firebase Security Rules

Add these rules in Firebase Console → Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This ensures users can only access their own data.

## Usage Tips

- Generate 5-10 cards at a time for best results
- Review cards daily for optimal retention
- Rate honestly: "Hard" if you struggled, "Easy" if it was instant
- The app learns your weak spots and shows them more often

## Troubleshooting

**Cards not syncing?**
- Check your internet connection
- Verify Firebase config is correct
- Check browser console for errors

**API errors?**
- Verify your OpenAI API key is valid
- Check you have credits in your OpenAI account
- Try refreshing the page

**Mobile issues?**
- Use a modern browser (Chrome, Safari, Firefox)
- Enable JavaScript
- Clear cache if things look broken
