# AKVORA ID Generation Implementation

## Overview
This document describes the complete implementation of AKVORA ID generation and display in the AKVORA MERN stack application.

## AKVORA ID Format

**Format:** `AKVORA:<YEAR>:<UNIQUE_NUMBER>`

**Example:** `AKVORA:2026:013`

**Rules:**
- Unique identifier for each user
- Auto-generated on first profile save
- Never changes once generated
- Non-editable by users
- Stored in MongoDB
- 3-digit zero-padded number (001, 002, ..., 013, etc.)

## Implementation Details

### 1. Database Schema

**User Model** (`server/models/User.js`)
```javascript
{
  akvoraId: {
    type: String,
    unique: true,
    sparse: true
  },
  registeredYear: Number,
  // ... other fields
}
```

**Counter Model** (`server/models/Counter.js`)
```javascript
{
  name: 'akvoraIdCounter',
  currentCount: Number (default: 0)
}
```

### 2. Backend Implementation

#### AKVORA ID Generator (`server/utils/akvoraIdGenerator.js`)
- Uses atomic MongoDB operations for concurrency safety
- Generates IDs in format: `AKVORA:YEAR:NUMBER`
- Ensures uniqueness across all users
- 3-digit zero-padding (001, 002, ..., 013)

**Key Features:**
- Atomic counter increment using `findOneAndUpdate`
- Thread-safe for concurrent requests
- Continuous numbering across years

#### Profile Controller (`server/controllers/userController.js`)

**`createOrUpdateProfile()` Function:**
- Generates AKVORA ID only if user doesn't have one
- Checks `if (!user.akvoraId)` before generating
- Never overwrites existing AKVORA ID
- Links ID to user account in MongoDB

**Logic Flow:**
1. Find user by `clerkId`
2. If new user → Generate AKVORA ID immediately
3. If existing user → Check if `akvoraId` exists
4. If no `akvoraId` → Generate new one
5. If `akvoraId` exists → Keep existing (never change)

#### Admin Controller (`server/controllers/adminController.js`)

**`getAllUserProfiles()` Function:**
- Includes `akvoraId` in response
- Shows "Pending" if ID not yet generated
- Returns all profile data including AKVORA ID

### 3. Frontend Implementation

#### User Profile Page (`client/src/pages/Profile.jsx`)

**AKVORA ID Display:**
- Read-only display (not an input field)
- Shows in profile header card
- Format: Large heading display
- Shows "Pending" if ID not yet generated
- Updates automatically after profile save

**Profile Fields:**
- AKVORA ID (read-only, auto-generated) ✅
- First Name (editable)
- Last Name (editable)
- Email (editable)
- Phone Number (editable)
- Name in Certificate (editable)

**Save Profile Flow:**
1. User fills profile form
2. Clicks "Save Profile"
3. Backend checks for existing AKVORA ID
4. If no ID → Generates new one
5. If ID exists → Keeps existing
6. Saves all profile data to MongoDB
7. Frontend displays updated AKVORA ID

#### Admin User Profiles Page (`client/src/pages/AdminUserProfiles.jsx`)

**Table Columns:**
1. S.No
2. **AKVORA ID** (NEW) - Styled badge
3. User Email
4. First Name
5. Last Name
6. Phone Number
7. Name in Certificate
8. Profile Status
9. Created Date
10. Updated Date

**Features:**
- AKVORA ID displayed in styled badge
- Shows "Pending" for users without ID
- All data fetched dynamically from MongoDB
- Real-time updates on refresh

### 4. API Endpoints

#### User Profile Save
- **Endpoint:** `POST /api/users/create-profile`
- **Auth:** Clerk JWT token required
- **Behavior:** Generates AKVORA ID if not exists, preserves if exists

#### Get User Profile
- **Endpoint:** `GET /api/users/profile`
- **Auth:** Clerk JWT token required
- **Response:** Includes `akvoraId` field

#### Get All User Profiles (Admin)
- **Endpoint:** `GET /api/admin/user-profiles`
- **Auth:** Admin JWT token required
- **Response:** Includes `akvoraId` for all users

## Security & Uniqueness

### Concurrency Safety
- Uses MongoDB atomic operations (`findOneAndUpdate`)
- Prevents duplicate ID generation
- Thread-safe for concurrent requests

### Uniqueness Guarantee
- MongoDB unique index on `akvoraId` field
- Atomic counter prevents collisions
- Database-level constraint enforcement

### Immutability
- AKVORA ID never changes once generated
- Backend logic prevents overwriting
- User cannot edit AKVORA ID (read-only in UI)

## User Flow

### First-Time Profile Save
1. User logs in via Clerk
2. Navigates to `/profile`
3. Fills profile form (First Name, Last Name, Email, Phone, Certificate Name)
4. AKVORA ID shows "Pending"
5. Clicks "Save Profile"
6. Backend generates AKVORA ID: `AKVORA:2026:001`
7. ID is saved to MongoDB
8. Profile page displays new AKVORA ID

### Subsequent Profile Updates
1. User updates profile fields
2. Clicks "Save Profile"
3. Backend checks existing AKVORA ID
4. Existing ID is preserved (not regenerated)
5. Only profile fields are updated
6. AKVORA ID remains unchanged

### Admin View
1. Admin logs in
2. Navigates to "User Profiles"
3. Sees table with all user profiles
4. AKVORA ID column shows all IDs
5. Can refresh to see latest data

## Testing Steps

### Test Case 1: First Profile Save
1. Login as new user
2. Navigate to `/profile`
3. Verify AKVORA ID shows "Pending"
4. Fill profile form
5. Click "Save Profile"
6. Verify:
   - AKVORA ID is generated (format: AKVORA:YEAR:XXX)
   - ID is displayed in profile header
   - ID is stored in MongoDB

### Test Case 2: Profile Update (ID Preservation)
1. User with existing AKVORA ID
2. Update profile fields
3. Click "Save Profile"
4. Verify:
   - AKVORA ID remains unchanged
   - Profile fields are updated
   - Updated timestamp changes

### Test Case 3: Admin View
1. Login as admin
2. Navigate to "User Profiles"
3. Verify:
   - AKVORA ID column is visible
   - All user IDs are displayed
   - Format matches: AKVORA:YEAR:XXX
   - "Pending" shown for users without ID

### Test Case 4: Uniqueness
1. Create multiple users
2. Save profiles simultaneously
3. Verify:
   - Each user gets unique AKVORA ID
   - No duplicate IDs generated
   - Sequential numbering works correctly

### Test Case 5: Read-Only Display
1. Login as user
2. Navigate to `/profile`
3. Verify:
   - AKVORA ID is displayed (not input field)
   - Cannot edit AKVORA ID
   - ID updates automatically after save

## Files Modified

### Backend
- `server/models/User.js` - Already has `akvoraId` field ✅
- `server/models/Counter.js` - Counter for ID generation ✅
- `server/utils/akvoraIdGenerator.js` - ID generation logic ✅
- `server/controllers/userController.js` - Profile save logic (preserves ID) ✅
- `server/controllers/adminController.js` - Updated to include `akvoraId` ✅
- `server/routes/admin.js` - Already has route ✅

### Frontend
- `client/src/pages/Profile.jsx` - Already displays AKVORA ID (read-only) ✅
- `client/src/pages/AdminUserProfiles.jsx` - Added AKVORA ID column ✅
- `client/src/pages/AdminUserProfiles.css` - Added badge styling ✅

## Key Features

✅ **Auto-Generation:** AKVORA ID generated automatically on first profile save
✅ **Uniqueness:** Atomic counter ensures unique IDs
✅ **Immutability:** ID never changes once generated
✅ **Read-Only:** Users cannot edit AKVORA ID
✅ **Format:** Strict format `AKVORA:YEAR:NUMBER` (e.g., AKVORA:2026:013)
✅ **Concurrency Safe:** Thread-safe ID generation
✅ **Admin View:** AKVORA ID visible in admin profiles table
✅ **Database Storage:** ID stored in MongoDB User model

## Notes

- AKVORA ID format uses 3-digit zero-padding (001, 002, ..., 013)
- Counter increments continuously across years
- First user gets AKVORA:YEAR:001, second gets AKVORA:YEAR:002, etc.
- If counter starts at 0, first increment makes it 1, so first ID is 001
- Profile page shows "Pending" until ID is generated
- Admin table shows "Pending" for users without ID

