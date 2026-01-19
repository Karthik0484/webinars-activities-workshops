# Block User With Reason - Implementation

## Overview
This document describes the complete implementation of blocking users with reason in the AKVORA MERN stack application.

## Features Implemented

### 1. Database Schema Updates

**User Model** (`server/models/User.js`)
- Added `status` field: enum ['ACTIVE', 'BLOCKED', 'DELETED'], default: 'ACTIVE'
- Added `blockReason` field: String, default: ''
- Added `blockedAt` field: Date, default: null

**Migration Notes:**
- Existing users will have `status: 'ACTIVE'` by default
- `isBlocked` field is maintained for backward compatibility
- Status field takes precedence over `isBlocked` boolean

### 2. Backend Implementation

#### Block User API (`server/controllers/adminController.js`)

**Endpoint:** `PUT /api/admin/users/:userId/block`

**Request Body:**
```json
{
  "blockReason": "Violation of terms of service"
}
```

**Logic:**
- Validates admin authorization
- Requires `blockReason` (mandatory)
- Updates user:
  - `status = 'BLOCKED'`
  - `isBlocked = true`
  - `blockReason = <provided reason>`
  - `blockedAt = current timestamp`
- Preserves AKVORA ID (never changes)

**Response:**
```json
{
  "success": true,
  "message": "User blocked successfully",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "status": "BLOCKED",
    "blockReason": "Violation of terms",
    "blockedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Unblock User API

**Endpoint:** `PUT /api/admin/users/:userId/unblock`

**Logic:**
- Clears `blockReason` (sets to empty string)
- Clears `blockedAt` (sets to null)
- Sets `status = 'ACTIVE'`
- Sets `isBlocked = false`
- User regains full access

### 3. Middleware Updates

#### Clerk Auth Middleware (`server/middleware/clerkAuth.js`)
- Attaches `status`, `blockReason`, `blockedAt` to request
- Determines status from `status` field or falls back to `isBlocked`/`isDeleted`

#### Check User Status (`server/middleware/checkUserStatus.js`)
- Checks `status` field first
- Blocks access if `status === 'BLOCKED'` or `status === 'DELETED'`
- Allows profile routes for blocked users
- Blocks all other routes

### 4. Frontend Implementation

#### Admin Users Page (`client/src/pages/AdminUsers.jsx`)

**Block Reason Modal:**
- Opens when admin clicks "Block" button
- Modal includes:
  - User email display
  - Required textarea for block reason
  - Character hint/guidance
  - Cancel and Confirm buttons
- Validation: Reason is mandatory
- On confirm: Sends reason to backend

**Status Badge:**
- Shows ACTIVE / BLOCKED / DELETED
- Uses `status` field from backend
- Color-coded badges

**Action Buttons:**
- Block button → Opens reason modal
- Unblock button → Clears reason and unblocks
- Delete button → Permanent deletion

#### User Profile Page (`client/src/pages/Profile.jsx`)

**Blocked User Display:**
- Conditional rendering based on `status === 'BLOCKED'`
- Shows ONLY blocked message card (no profile form)
- Blocked message includes:
  - Warning icon
  - "Your account has been blocked by the AKVORA admin."
  - **Block Reason** (from admin)
  - Support contact information
- Profile form is completely hidden when blocked

**Unblocked User Display:**
- Shows full profile form
- No blocked message visible
- Full functionality restored

### 5. UI Components

#### Block Reason Modal
- Clean, centered modal design
- Textarea with placeholder
- Required field indicator
- Disabled confirm button until reason provided
- Cancel and Confirm actions

#### Blocked User Card
- Prominent warning design
- Block reason displayed in highlighted box
- Support contact information
- Clear visual hierarchy

## User Flow

### Admin Blocks User
1. Admin clicks "Block" button
2. Modal opens asking for block reason
3. Admin enters reason (required)
4. Clicks "Confirm Block"
5. Backend updates:
   - `status = 'BLOCKED'`
   - `blockReason = <reason>`
   - `blockedAt = <timestamp>`
6. User is blocked
7. Table refreshes showing updated status

### Blocked User Experience
1. User logs in successfully
2. Redirected to `/profile` page
3. Sees blocked message card ONLY
4. Message includes:
   - Block reason from admin
   - Support contact information
5. Cannot access:
   - Profile form
   - Other pages (redirected to profile)
   - Protected APIs (except profile)

### Admin Unblocks User
1. Admin clicks "Unblock" button
2. Backend clears:
   - `blockReason = ''`
   - `blockedAt = null`
   - `status = 'ACTIVE'`
3. User regains full access
4. Profile page shows full form again

## API Endpoints

### Block User
- **Method:** PUT
- **Endpoint:** `/api/admin/users/:userId/block`
- **Auth:** Admin JWT token required
- **Body:** `{ blockReason: string }`
- **Response:** User object with updated status

### Unblock User
- **Method:** PUT
- **Endpoint:** `/api/admin/users/:userId/unblock`
- **Auth:** Admin JWT token required
- **Response:** User object with ACTIVE status

## Security Features

1. **Admin-Only:** Block/unblock endpoints require admin authentication
2. **Reason Required:** Block reason is mandatory
3. **Status Enforcement:** Middleware checks status on all requests
4. **AKVORA ID Protection:** ID never changes when blocking/unblocking
5. **Route Protection:** Blocked users can only access profile routes

## Files Modified

### Backend
- `server/models/User.js` - Added status, blockReason, blockedAt fields
- `server/controllers/adminController.js` - Updated block/unblock functions
- `server/controllers/userController.js` - Added status fields to response
- `server/middleware/clerkAuth.js` - Added status to request object
- `server/middleware/checkUserStatus.js` - Updated to check status field

### Frontend
- `client/src/pages/AdminUsers.jsx` - Added block reason modal
- `client/src/pages/AdminUsers.css` - Added modal styling
- `client/src/pages/Profile.jsx` - Added block reason display
- `client/src/pages/Profile.css` - Added block reason styling

## Testing Steps

### Test Case 1: Block User with Reason
1. Login as admin
2. Navigate to Users page
3. Click "Block" button for a user
4. Verify modal opens
5. Enter block reason
6. Click "Confirm Block"
7. Verify:
   - User status changes to BLOCKED
   - Reason is saved
   - blockedAt timestamp is set
   - AKVORA ID remains unchanged

### Test Case 2: Blocked User View
1. Login as blocked user
2. Navigate to `/profile`
3. Verify:
   - Only blocked message is visible
   - Block reason is displayed
   - Profile form is hidden
   - Support contact info is shown

### Test Case 3: Unblock User
1. Admin clicks "Unblock" for blocked user
2. Verify:
   - Status changes to ACTIVE
   - Block reason is cleared
   - blockedAt is cleared
   - User can access all features again

### Test Case 4: Route Protection
1. Block a user
2. Try to access protected routes as that user
3. Verify:
   - All routes redirect to `/profile`
   - Only profile page is accessible
   - API calls return 403 for non-profile routes

### Test Case 5: Validation
1. Try to block without reason
2. Verify:
   - Modal prevents submission
   - Error message shown
   - User not blocked

## Notes

- Status field takes precedence over `isBlocked` boolean
- Backward compatibility maintained with `isBlocked` field
- Block reason is displayed to user for transparency
- Support contact information helps users resolve issues
- AKVORA ID is never affected by block/unblock operations

