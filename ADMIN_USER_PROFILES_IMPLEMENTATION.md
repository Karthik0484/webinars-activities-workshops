# Admin User Profiles Implementation

## Overview
This document describes the implementation of the Admin User Profiles page in the AKVORA MERN stack application.

## Features Implemented

### 1. User Profile Saving (Already Exists)
Users can save their profile with the following fields:
- First Name
- Last Name
- Email
- Phone Number
- Name in Certificate

**Implementation:**
- Profile saving is handled by `POST /api/users/create-profile` endpoint
- Data is stored in MongoDB User model
- Profile completion status is tracked via `profileCompleted` field

### 2. Admin User Profiles Page (NEW)

#### Backend Implementation

**Controller Function** (`server/controllers/adminController.js`)
- `getAllUserProfiles()` - Fetches all user profiles from MongoDB
- Excludes admin users and deleted users
- Returns profile data with timestamps

**API Endpoint** (`server/routes/admin.js`)
- `GET /api/admin/user-profiles` - Admin protected endpoint
- Requires JWT admin authentication
- Returns all user profiles sorted by most recently updated

#### Frontend Implementation

**Component** (`client/src/pages/AdminUserProfiles.jsx`)
- Displays user profiles in a table format
- Shows profile statistics (total profiles, completed profiles)
- Includes refresh functionality
- Responsive design

**Table Columns:**
1. S.No - Serial number
2. User Email - User's email address
3. First Name - User's first name
4. Last Name - User's last name
5. Phone - User's phone number
6. Name in Certificate - Certificate name
7. Profile Status - Completed/Incomplete badge
8. Created Date - Profile creation timestamp
9. Updated Date - Last profile update timestamp

### 3. Navigation Updates

**Admin Dashboard Navigation:**
- Added "User Profiles" button in navigation menu
- Positioned after "Users" button
- Active state highlighting

**Updated Files:**
- `client/src/pages/AdminDashboard.jsx` - Added navigation button
- `client/src/pages/AdminUsers.jsx` - Added navigation button
- `client/src/App.jsx` - Added route for `/admin/user-profiles`

## Database Schema

The User model already includes all required fields:

```javascript
{
  firstName: String,
  lastName: String,
  email: String (required),
  phone: String,
  certificateName: String,
  profileCompleted: Boolean,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

## API Endpoints

### Get All User Profiles
- **Endpoint:** `GET /api/admin/user-profiles`
- **Authentication:** Admin JWT token required
- **Response:**
```json
{
  "success": true,
  "profiles": [
    {
      "_id": "...",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "certificateName": "John Doe",
      "profileCompleted": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

## File Structure

### Backend Files
- `server/models/User.js` - User schema (already exists)
- `server/controllers/adminController.js` - Added `getAllUserProfiles()` function
- `server/routes/admin.js` - Added `/user-profiles` route

### Frontend Files
- `client/src/pages/AdminUserProfiles.jsx` - NEW - Main component
- `client/src/pages/AdminUserProfiles.css` - NEW - Styling
- `client/src/pages/AdminDashboard.jsx` - Updated navigation
- `client/src/pages/AdminUsers.jsx` - Updated navigation
- `client/src/App.jsx` - Added route

## User Flow

### User Profile Saving
1. User logs in via Clerk
2. Navigates to Profile page (`/profile`)
3. Fills in profile fields:
   - First Name
   - Last Name
   - Email
   - Phone Number
   - Name in Certificate
4. Clicks "Save Profile"
5. Data is saved to MongoDB via `POST /api/users/create-profile`
6. `profileCompleted` is set to `true`
7. `updatedAt` timestamp is updated

### Admin Viewing Profiles
1. Admin logs in at `/admin/login`
2. Navigates to Admin Dashboard
3. Clicks "User Profiles" in navigation
4. Page fetches all user profiles from MongoDB
5. Displays profiles in table format
6. Can refresh to get latest data

## Testing Steps

### Test Case 1: User Saves Profile
1. Login as a regular user
2. Navigate to `/profile`
3. Fill in all profile fields
4. Click "Save Profile"
5. Verify success message
6. Verify profile is saved in MongoDB

### Test Case 2: Admin Views Profiles
1. Login as admin
2. Navigate to Admin Dashboard
3. Click "User Profiles" button
4. Verify:
   - Table displays all user profiles
   - All columns are visible
   - Data matches MongoDB records
   - Profile status badges show correctly
   - Dates are formatted properly

### Test Case 3: Profile Updates
1. User updates their profile
2. Admin refreshes User Profiles page
3. Verify:
   - Updated data is displayed
   - Updated Date shows latest timestamp
   - Created Date remains unchanged

### Test Case 4: Navigation
1. From Admin Dashboard, click "User Profiles"
2. Verify navigation works
3. From Admin Users page, click "User Profiles"
4. Verify navigation works
5. Verify active state highlighting

## Features

- **Real-time Data:** All data fetched from MongoDB (no hardcoded values)
- **Profile Status:** Visual badges for Completed/Incomplete profiles
- **Statistics:** Shows total profiles and completed profiles count
- **Responsive Design:** Works on desktop and mobile devices
- **Error Handling:** Displays error messages if API calls fail
- **Loading States:** Shows loading indicator while fetching data
- **Refresh Functionality:** Manual refresh button to reload data

## Security

- Admin-only access (JWT protected)
- Excludes deleted users from results
- Excludes admin users from results
- All API calls require authentication

## Notes

- Profile data is linked to user accounts via MongoDB `_id`
- Timestamps (`createdAt`, `updatedAt`) are automatically managed by Mongoose
- Empty fields display as "N/A" in the table
- Profile completion status is tracked via `profileCompleted` boolean field

