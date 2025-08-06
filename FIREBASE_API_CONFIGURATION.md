# Firebase API Configuration Guide

## Issue: Token Refresh API Blocked

If you're seeing errors like:
```
auth/requests-to-this-api-securetoken.googleapis.com-securetoken.v1.securetoken.granttoken-are-blocked
```

This means Firebase's token refresh API is being blocked. Here's how to fix it:

## Solution 1: Configure Firebase API Key (Recommended)

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select your Firebase project

2. **Navigate to API Keys:**
   - Go to "APIs & Services" → "Credentials"
   - Find your API key (starts with `AIzaSyARj...`)

3. **Configure API Restrictions:**
   - Click on your API key
   - Under "API restrictions" → Select "Restrict key"
   - Enable these APIs:
     - ✅ Firebase Authentication API
     - ✅ Google Identity Toolkit API
     - ✅ Cloud Firestore API
     - ✅ Cloud Functions API
     - ✅ Identity and Access Management (IAM) API

4. **Configure Application Restrictions:**
   - Under "Application restrictions"
   - Select "HTTP referrers (web sites)"
   - Add these domains:
     ```
     http://localhost:*
     https://localhost:*
     https://*.firebaseapp.com/*
     https://*.web.app/*
     ```

## Solution 2: Development Workaround

If you're in development and the above doesn't work:

1. **Temporarily remove API restrictions:**
   - In Google Cloud Console → API Keys
   - Select "Don't restrict key" (for development only)
   - ⚠️ **Remember to re-enable restrictions for production**

2. **Use Firebase Emulator (Alternative):**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init emulators
   firebase emulators:start --only auth
   ```

## Solution 3: Environment Variables

Ensure your `.env` file has the correct Firebase configuration:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## Current App Behavior

✅ **Good News:** Your app is handling this gracefully!

- **User stays logged in** despite token refresh issues
- **Cloud Functions work normally** (they use server-side auth)
- **Data loads successfully** 
- **Status indicator shows** "API access restricted - session maintained"

## Production Deployment

For production:
1. ✅ Configure API restrictions properly
2. ✅ Add your production domain to authorized domains
3. ✅ Test token refresh functionality
4. ✅ Monitor for authentication errors

## Troubleshooting

If issues persist:
1. Check Firebase Console → Authentication → Settings
2. Verify authorized domains include your deployment URL
3. Check browser network tab for specific error details
4. Consider using Firebase Auth Emulator for development

## Security Note

⚠️ **Never deploy with unrestricted API keys to production!**
Always configure proper API and domain restrictions before going live.