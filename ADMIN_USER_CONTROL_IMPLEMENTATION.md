# Admin User Control Implementation

## Overview
This document describes the implementation of admin control features for user management in the AKVORA MERN stack application.

## Features Implemented

### 1. Database Changes
- **User Model** (`server/models/User.js`):
  - Added `isBlocked: Boolean` (default: false)
  - Added `isDeleted: Boolean` (default: false)

### 2. Backend API Endpoints

#### GET `/api/admin/users`
- Returns all email/password registered users
- Includes `isBlocked` and `isDeleted` status
- Admin protected (requires JWT token)

#### PUT `/api/admin/users/:id/block`
- Blocks a user by setting `isBlocked = true`
- Prevents user from accessing the application
- Admin protected

#### PUT `/api/admin/users/:id/unblock`
- Unblocks a user by setting `isBlocked = false`
- Restores user access
- Admin protected

#### DELETE `/api/admin/users/:id`
- Permanently deletes a user:
  1. Marks `isDeleted = true` in MongoDB
  2. Sets `isBlocked = true` (double protection)
  3. Deletes user from Clerk using Clerk Admin SDK
- Admin protected

### 3. Authentication Enforcement

#### Middleware Updates (`server/middleware/clerkAuth.js`)
- Checks MongoDB user status on every authenticated request
- Blocks access if `isDeleted = true` → Returns: "Your account has been deleted by admin"
- Blocks access if `isBlocked = true` → Returns: "Your account has been blocked by admin"

### 4. Frontend Features

#### Admin Users Page (`client/src/pages/AdminUsers.jsx`)
- **Status Column**: Shows Active/Blocked/Deleted status with color-coded badges
- **Actions Column**: 
  - Block button (shown when user is active)
  - Unblock button (shown when user is blocked)
  - Delete button (shown for active/blocked users, hidden for deleted)
- **Delete Confirmation Modal**: 
  - Shows user email
  - Warning message about permanent deletion
  - Cancel and Confirm buttons
- **Toast Notifications**: Success/error messages for all actions
- **Auto-refresh**: Table refreshes after each action

## File Changes Summary

### Backend Files Modified:
1. `server/models/User.js` - Added isBlocked and isDeleted fields
2. `server/controllers/adminController.js` - Added block/unblock/delete functions
3. `server/routes/admin.js` - Added new routes for user actions
4. `server/middleware/clerkAuth.js` - Added blocked/deleted user checks

### Frontend Files Modified:
1. `client/src/pages/AdminUsers.jsx` - Added action buttons and delete modal
2. `client/src/pages/AdminUsers.css` - Added styles for buttons, badges, and modal

## Testing Steps

### Prerequisites
1. Ensure MongoDB is running
2. Ensure backend server is running (`npm run server`)
3. Ensure frontend is running (`npm run client`)
4. Have admin credentials ready (default: admin@akvora.com / admin123)

### Test Case 1: View Users
1. Login as admin at `/admin/login`
2. Navigate to "Users" page
3. Verify users are displayed in table with columns:
   - S.No
   - Email
   - Auth Provider
   - Status (Active/Blocked/Deleted)
   - Created Date
   - Actions

### Test Case 2: Block User
1. Find an active user in the table
2. Click "Block" button
3. Verify:
   - Toast shows "User blocked successfully"
   - Status changes to "Blocked" (red badge)
   - Block button is replaced with "Unblock" button
4. Test blocked user login:
   - Try to login with blocked user's credentials
   - Should receive error: "Your account has been blocked by admin"

### Test Case 3: Unblock User
1. Find a blocked user in the table
2. Click "Unblock" button
3. Verify:
   - Toast shows "User unblocked successfully"
   - Status changes to "Active" (green badge)
   - Unblock button is replaced with "Block" button
4. Test unblocked user login:
   - User should be able to login successfully

### Test Case 4: Delete User
1. Find an active or blocked user
2. Click "Delete" button
3. Verify delete confirmation modal appears with:
   - User email displayed
   - Warning message about permanent deletion
4. Click "Delete Permanently"
5. Verify:
   - Toast shows "User deleted successfully"
   - Status changes to "Deleted" (gray badge)
   - Action buttons are hidden (only "Deleted" label shown)
   - User is deleted from Clerk (check Clerk dashboard)
6. Test deleted user login:
   - Try to login with deleted user's credentials
   - Should receive error: "Your account has been deleted by admin"

### Test Case 5: Security Checks
1. Try to block/unblock/delete admin user:
   - Should receive error: "Cannot block/delete admin users"
2. Verify all endpoints require admin authentication:
   - Try accessing endpoints without token → Should fail
   - Try accessing with non-admin token → Should fail

### Test Case 6: Middleware Enforcement
1. Block a user via admin panel
2. While logged in as that user, try to access any protected route
3. Verify:
   - Request is blocked
   - Error message: "Your account has been blocked by admin"
4. Repeat with deleted user:
   - Error message: "Your account has been deleted by admin"

## Security Features

1. **Admin-Only Access**: All endpoints protected with `verifyAdminToken` middleware
2. **Admin Protection**: Cannot block/delete admin users
3. **Double Protection**: Deleted users are also blocked
4. **Clerk Integration**: Users deleted from Clerk cannot authenticate
5. **Middleware Checks**: Every authenticated request checks user status

## Error Handling

- All API calls include try-catch blocks
- Frontend shows error toasts for failed operations
- Backend returns appropriate HTTP status codes:
  - 401: Unauthorized
  - 403: Forbidden (blocked/deleted/admin protection)
  - 404: User not found
  - 500: Server error

## Notes

- Deleted users remain in MongoDB (soft delete) for audit purposes
- Clerk deletion is permanent and cannot be undone
- Blocked users can be unblocked by admin
- Deleted users cannot be restored (permanent action)


