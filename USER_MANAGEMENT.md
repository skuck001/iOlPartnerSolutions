# User Management Guide

## Overview
The iOL Partner Solutions Tracker uses Firebase Authentication for user login. Users cannot self-register through the application - accounts must be created manually in Firebase Console for security.

## Creating New Users

### Method 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `iol-partner-solutions`
3. Navigate to **Authentication** > **Users**
4. Click **Add user**
5. Enter:
   - **Email**: User's work email address
   - **Password**: Temporary secure password (user should change on first login)
6. Click **Add user**

### Method 2: Firebase Admin SDK (For Bulk Operations)
```javascript
// Example code for creating users programmatically
const admin = require('firebase-admin');

async function createUser(email, password, displayName) {
  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
    });
    console.log('Successfully created new user:', userRecord.uid);
    return userRecord;
  } catch (error) {
    console.log('Error creating new user:', error);
  }
}
```

## User Document Creation
When a user logs in for the first time, the application automatically creates a user document in Firestore with:

```javascript
{
  id: "firebase_user_id",
  email: "user@example.com",
  displayName: "User Name", // if provided
  role: "user", // default role
  permissions: [], // empty array for now
  createdAt: timestamp,
  lastLoginAt: timestamp
}
```

## User Roles & Permissions

### Current Roles
- **user**: Default role for all users
- **admin**: Future role for administrators
- **manager**: Future role for managers

### Future Permission System
The `permissions` array in user documents can be used to implement granular permissions:
- `read:accounts`
- `write:accounts`
- `read:opportunities`
- `write:opportunities`
- `admin:users`
- etc.

## User Management Best Practices

### Password Security
- Use strong temporary passwords (12+ characters)
- Include uppercase, lowercase, numbers, and symbols
- Require users to change password on first login

### Email Guidelines
- Use work email addresses only
- Ensure email domain matches company domain
- Verify email ownership before creating account

### Account Cleanup
- Regularly review user list for inactive accounts
- Disable accounts for departed employees
- Remove unused test accounts

## Troubleshooting

### Common Issues
1. **User can't log in**: Check if account exists in Firebase Console
2. **Access denied**: Verify user document was created in Firestore
3. **Wrong role displayed**: Check user document in Firestore `users` collection

### Checking User Documents
1. Go to Firebase Console > Firestore Database
2. Navigate to `users` collection
3. Find document by user's Firebase Auth UID
4. Verify all fields are present and correct

## Security Notes
- Never share Firebase Admin credentials
- Use environment-specific projects (dev/staging/prod)
- Monitor authentication logs for suspicious activity
- Implement proper backup procedures for user data

## Support
For user management issues, contact the development team or check the Firebase Console logs. 