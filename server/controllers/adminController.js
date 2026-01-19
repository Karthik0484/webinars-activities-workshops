import User from '../models/User.js';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { generateAkvoraId } from '../utils/akvoraIdGenerator.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Clerk client for admin operations
const clerk = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

/**
 * Get all users who registered using email and password authentication
 * Admin only endpoint
 */
export async function getEmailPasswordUsers(req, res) {
  try {
    // Find all users with authProvider = 'email' and role = 'user' (exclude admins)
    // Also include users who have a password but no clerkId (email/password users)
    // This ensures we capture email/password registered students
    // Find all users with authProvider = 'email'
    // This includes users we synced from Clerk (auto-created)
    // and potentially legacy users
    const users = await User.find({
      $or: [
        { authProvider: 'email' },
        // Fallback for older records where authProvider might be 'clerk' but no external accounts
        // or explicitly have a password set locally
        { password: { $exists: true, $ne: '' } }
      ],
      role: 'user' // Exclude admins
    })
      .select('email password authProvider createdAt isBlocked isDeleted clerkId akvoraId status blockReason blockedAt')
      .sort({ createdAt: -1 });

    // Auto-generate AKVORA ID for users without one
    const usersWithIds = await Promise.all(
      users.map(async (user) => {
        if (!user.akvoraId) {
          try {
            // Generate AKVORA ID for users without one
            const { akvoraId, year } = await generateAkvoraId();
            user.akvoraId = akvoraId;
            if (!user.registeredYear) {
              user.registeredYear = year;
            }
            await user.save();
            console.log(`Generated AKVORA ID for user ${user.email}: ${akvoraId}`);
          } catch (idError) {
            console.error(`Error generating AKVORA ID for user ${user.email}:`, idError);
            // Continue even if ID generation fails (might be duplicate, etc.)
          }
        }
        return user;
      })
    );

    // Format response
    const formattedUsers = usersWithIds.map(user => {
      // Determine status: prefer status field, fallback to isBlocked/isDeleted
      let userStatus = user.status || 'ACTIVE';
      if (user.isDeleted) {
        userStatus = 'DELETED';
      } else if (user.isBlocked && !user.status) {
        userStatus = 'BLOCKED';
      }

      return {
        _id: user._id,
        email: user.email,
        akvoraId: user.akvoraId || 'Pending',
        authProvider: user.authProvider || 'email',
        createdAt: user.createdAt,
        password: user.password ? 'Encrypted' : 'Not set',
        status: userStatus,
        isBlocked: user.isBlocked || false,
        isDeleted: user.isDeleted || false,
        blockReason: user.blockReason || '',
        blockedAt: user.blockedAt || null,
        clerkId: user.clerkId || null
      };
    });

    res.json({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    });
  } catch (error) {
    console.error('Get email/password users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

/**
 * Block a user with reason
 * Admin only endpoint
 */
export async function blockUser(req, res) {
  try {
    const { id } = req.params;
    const { blockReason } = req.body;

    // Validate block reason is provided
    if (!blockReason || blockReason.trim() === '') {
      return res.status(400).json({ error: 'Block reason is required' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot block admin users' });
    }

    // Update user status and block information
    user.isBlocked = true;
    user.status = 'BLOCKED';
    user.blockReason = blockReason.trim();
    user.blockedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'User blocked successfully',
      user: {
        _id: user._id,
        email: user.email,
        status: user.status,
        isBlocked: user.isBlocked,
        blockReason: user.blockReason,
        blockedAt: user.blockedAt
      }
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
}

/**
 * Unblock a user
 * Admin only endpoint
 * Clears block reason and sets status back to ACTIVE
 */
export async function unblockUser(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear block information and set status to ACTIVE
    user.isBlocked = false;
    user.status = 'ACTIVE';
    user.blockReason = '';
    user.blockedAt = null;
    await user.save();

    res.json({
      success: true,
      message: 'User unblocked successfully',
      user: {
        _id: user._id,
        email: user.email,
        status: user.status,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
}

/**
 * Delete a user permanently
 * Admin only endpoint
 * This will:
 * 1. Mark user as deleted in MongoDB
 * 2. Delete user from Clerk (if clerkId exists)
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }

    // Delete from Clerk if clerkId exists
    if (user.clerkId) {
      try {
        await clerk.users.deleteUser(user.clerkId);
        console.log(`Deleted user ${user.email} from Clerk (ID: ${user.clerkId})`);
      } catch (clerkError) {
        console.error('Error deleting user from Clerk:', clerkError);
        // Continue with MongoDB deletion even if Clerk deletion fails
        // This ensures the user is still marked as deleted in our system
      }
    }

    // Mark as deleted in MongoDB
    user.isDeleted = true;
    user.isBlocked = true; // Also block to prevent any access
    await user.save();

    res.json({
      success: true,
      message: 'User deleted successfully',
      user: {
        _id: user._id,
        email: user.email,
        isDeleted: user.isDeleted
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

/**
 * Get all user profiles
 * Admin only endpoint
 * Returns all users with their profile information
 */
export async function getAllUserProfiles(req, res) {
  try {
    // Fetch all users with profile data (exclude admins and deleted users)
    const users = await User.find({
      role: 'user',
      isDeleted: { $ne: true }
    })
      .select('akvoraId email firstName lastName phone certificateName createdAt updatedAt profileCompleted')
      .sort({ updatedAt: -1 }); // Sort by most recently updated first

    // Format response with profile data
    const profiles = users.map((user, index) => ({
      _id: user._id,
      akvoraId: user.akvoraId || 'Pending',
      email: user.email,
      firstName: user.firstName || 'N/A',
      lastName: user.lastName || 'N/A',
      phone: user.phone || 'N/A',
      certificateName: user.certificateName || 'N/A',
      profileCompleted: user.profileCompleted || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json({
      success: true,
      profiles: profiles,
      count: profiles.length
    });
  } catch (error) {
    console.error('Get all user profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch user profiles' });
  }
}

