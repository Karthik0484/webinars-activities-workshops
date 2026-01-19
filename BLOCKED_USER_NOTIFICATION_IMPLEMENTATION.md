# Blocked User Notification Implementation

## Overview
This document describes the implementation of blocked user notifications and access restrictions in the AKVORA MERN stack application.

## Features Implemented

### 1. Backend Changes

#### Middleware Updates

**`server/middleware/clerkAuth.js`**
- Updated to attach user status (`isBlocked`, `isDeleted`) to request object
- No longer immediately blocks users - allows route-specific handling

**`server/middleware/checkUserStatus.js` (NEW)**
- Middleware to check user status and restrict access
- Blocked users can only access profile routes
- Deleted users are always blocked
- Applied to routes that should be restricted for blocked users

#### Route Protection

**`server/routes/users.js`**
- Profile routes (`/profile`, `/create-profile`, `/avatar`) are accessible to blocked users
- Other routes (`/akvora-id/:clerkId`) require user to not be blocked

**`server/routes/registrations.js`**
- Registration routes protected with `checkUserStatus` middleware
- Blocked users cannot register for workshops or view registrations

#### Controller Updates

**`server/controllers/userController.js`**
- `getProfile()` now returns `isBlocked` and `isDeleted` status
- Allows frontend to display appropriate UI based on user status

### 2. Frontend Changes

#### Profile Page (`client/src/pages/Profile.jsx`)
- Added `isBlocked` state tracking
- Displays prominent blocked user notification when `isBlocked = true`
- Notification includes:
  - Warning message: "Your account has been blocked by the AKVORA admin."
  - Support contact information:
    - Email: support@akvora.com
    - Phone: +91-XXXXXXXXXX

#### Routing Protection (`client/src/App.jsx`)
- Updated `ProtectedRoute` component to:
  - Check user status on mount
  - Automatically redirect blocked users to `/profile`
  - Prevent access to all routes except `/profile` for blocked users

#### Styling (`client/src/pages/Profile.css`)
- Added styles for blocked notification:
  - Yellow/orange gradient background
  - Warning icon
  - Clear contact information display
  - Responsive design

## User Flow

### Blocked User Experience

1. **Login**: Blocked users can successfully login via Clerk
2. **Redirect**: After login, blocked users are automatically redirected to `/profile`
3. **Notification**: Profile page displays prominent blocked notification with contact info
4. **Access Restriction**: 
   - Blocked users can only access `/profile` page
   - All other routes redirect to `/profile`
   - API calls to non-profile endpoints return 403 error
5. **Unblock**: When admin unblocks user, they regain full access automatically

### Admin Actions

1. **Block User**: Admin clicks "Block" → `isBlocked = true`
2. **Unblock User**: Admin clicks "Unblock" → `isBlocked = false`
3. **User Status**: Admin can see blocked status in Users table

## API Behavior

### Profile Routes (Allowed for Blocked Users)
- `GET /api/users/profile` ✅
- `POST /api/users/create-profile` ✅
- `PUT /api/users/profile` ✅
- `POST /api/users/avatar` ✅

### Restricted Routes (Blocked for Blocked Users)
- `GET /api/users/akvora-id/:clerkId` ❌
- `POST /api/registrations/` ❌
- `GET /api/registrations/my` ❌
- All other protected routes ❌

### Error Responses
- **403 Forbidden**: "Your account has been blocked by admin. Please contact support."
- **403 Forbidden**: "Your account has been deleted by admin" (for deleted users)

## Testing Steps

### Test Case 1: Block User and Verify Notification
1. Login as admin → Navigate to Users page
2. Block a test user
3. Login as the blocked user
4. Verify:
   - User is redirected to `/profile`
   - Blocked notification is displayed
   - Contact information is visible
   - User cannot navigate to other pages

### Test Case 2: Verify API Restrictions
1. Login as blocked user
2. Try to access restricted APIs:
   - `GET /api/users/akvora-id/:clerkId` → Should return 403
   - `POST /api/registrations/` → Should return 403
3. Verify profile APIs still work:
   - `GET /api/users/profile` → Should return 200 with `isBlocked: true`

### Test Case 3: Unblock User
1. Login as admin → Navigate to Users page
2. Unblock the test user
3. Login as the unblocked user
4. Verify:
   - User can access all routes
   - Blocked notification is not displayed
   - User can register for events

### Test Case 4: Frontend Redirect
1. Login as blocked user
2. Try to manually navigate to:
   - `/` → Should redirect to `/profile`
   - `/webinars` → Should redirect to `/profile`
   - `/workshops` → Should redirect to `/profile`
   - `/internships` → Should redirect to `/profile`
3. Verify only `/profile` is accessible

### Test Case 5: Deleted User
1. Login as admin → Delete a user
2. Try to login as deleted user
3. Verify:
   - All API calls return 403 with "deleted" message
   - User cannot access any routes

## Security Features

1. **Backend Enforcement**: All protected routes check user status
2. **Frontend Redirect**: Automatic redirect prevents UI access
3. **Profile Access**: Blocked users can still update their profile
4. **Contact Information**: Clear support channels for blocked users
5. **Admin Protection**: Admin users cannot be blocked

## Files Modified

### Backend
- `server/middleware/clerkAuth.js` - Updated to attach user status
- `server/middleware/checkUserStatus.js` - NEW - Route protection middleware
- `server/routes/users.js` - Profile routes accessible, others protected
- `server/routes/registrations.js` - Added status check
- `server/controllers/userController.js` - Returns blocked status

### Frontend
- `client/src/App.jsx` - Updated ProtectedRoute with status check
- `client/src/pages/Profile.jsx` - Added blocked notification UI
- `client/src/pages/Profile.css` - Added notification styles

## Notes

- Blocked users can still login (Clerk authentication succeeds)
- Blocked users can update their profile (allows them to contact support)
- All other functionality is restricted
- Notification is prominently displayed on profile page
- Contact information should be updated with actual support details

