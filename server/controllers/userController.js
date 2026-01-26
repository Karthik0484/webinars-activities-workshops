import User from '../models/User.js';
import OTP from '../models/OTP.js';
import { generateAkvoraId } from '../utils/akvoraIdGenerator.js';
import bcrypt from 'bcryptjs';

/**
 * Create or update user profile
 */
export async function createOrUpdateProfile(req, res) {
  try {
    const { clerkId, clerkEmail } = req;
    const { firstName, lastName, email, phone, certificateName, avatarUrl } = req.body;

    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use email from request body, or fallback to Clerk email, or empty string
    const userEmail = (email?.toLowerCase() || clerkEmail?.toLowerCase() || '').trim();

    // Find or create user
    let user = await User.findOne({ clerkId });

    if (!user) {
      // Generate AKVORA ID for new user
      const { akvoraId, year, counter } = await generateAkvoraId();

      user = await User.create({
        clerkId,
        akvoraId,
        firstName: firstName || '',
        lastName: lastName || '',
        email: userEmail,
        phone: phone || '',
        certificateName: certificateName || '',
        avatarUrl: avatarUrl || '',
        emailVerified: true, // OAuth users have verified emails
        profileCompleted: true,
        registeredYear: year
      });
    } else {
      // Update existing user
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      // Update email if provided, otherwise keep existing or use Clerk email
      if (userEmail) {
        user.email = userEmail;
      }
      user.phone = phone || user.phone;
      user.certificateName = certificateName || user.certificateName;
      if (avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      user.emailVerified = true; // OAuth users have verified emails
      user.profileCompleted = true;

      // Generate AKVORA ID if not exists
      if (!user.akvoraId) {
        const { akvoraId, year } = await generateAkvoraId();
        user.akvoraId = akvoraId;
        user.registeredYear = year;
      }

      await user.save();
    }

    res.json({
      success: true,
      user: {
        clerkId: user.clerkId,
        akvoraId: user.akvoraId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        certificateName: user.certificateName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        profileCompleted: user.profileCompleted,
        registeredYear: user.registeredYear
      }
    });
  } catch (error) {
    console.error('Create/Update profile error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'AKVORA ID already exists. Please try again.' });
    }
    res.status(500).json({ error: 'Failed to create/update profile' });
  }
}

/**
 * Get user profile
 * Automatically creates user in MongoDB if they exist in Clerk but not in DB
 */
export async function getProfile(req, res) {
  try {
    const { clerkId, clerkEmail, clerkUser } = req;

    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user = await User.findOne({ clerkId });

    if (!user) {
      // User exists in Clerk but not in MongoDB
      // Auto-create the user now
      console.log(`Auto-creating user for Clerk ID: ${clerkId}`);

      const { akvoraId, year } = await generateAkvoraId();

      // Default to 'email' if we can't determine provider, or check clerkUser
      // For this requirement, we assume email/password signup flow
      let authProvider = 'email';

      // If user has google, github in external accounts, we might switch
      if (clerkUser?.externalAccounts?.length > 0) {
        const provider = clerkUser.externalAccounts[0].provider; // e.g., 'oauth_google'
        if (provider.includes('google')) authProvider = 'google';
        if (provider.includes('github')) authProvider = 'github';
      }

      // Secure placeholder for password since Clerk handles it
      // We must store SOMETHING to satisfy the requirement "password must be hashed"
      const placeholderPassword = await bcrypt.hash('managed-by-clerk-secure', 10);

      user = await User.create({
        clerkId,
        akvoraId,
        firstName: clerkUser?.firstName || '',
        lastName: clerkUser?.lastName || '',
        email: clerkEmail || '',
        emailVerified: true, // Clerk users are verified
        profileCompleted: false, // Let them complete profile on frontend
        registeredYear: year,
        authProvider,
        password: placeholderPassword
      });

      console.log('User auto-created:', user._id);
    }

    res.json({
      success: true,
      user: {
        clerkId: user.clerkId,
        akvoraId: user.akvoraId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        certificateName: user.certificateName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        profileCompleted: user.profileCompleted,
        registeredYear: user.registeredYear,
        authProvider: user.authProvider,
        isBlocked: user.isBlocked // Return blocking status to frontend
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

/**
 * Get AKVORA ID for user
 */
export async function getAkvoraId(req, res) {
  try {
    const { clerkId } = req.params;

    if (!clerkId) {
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      akvoraId: user.akvoraId || null,
      profileCompleted: user.profileCompleted
    });
  } catch (error) {
    console.error('Get AKVORA ID error:', error);
    res.status(500).json({ error: 'Failed to get AKVORA ID' });
  }
}

import ProfileImage from '../models/ProfileImage.js';

/**
 * Update user avatar (MongoDB Buffer storage)
 */
export async function updateAvatar(req, res) {
  try {
    const { clerkId, clerkEmail } = req;
    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Find or create user
    let user = await User.findOne({ clerkId });

    if (!user) {
      // Create user if they don't exist
      const { akvoraId, year } = await generateAkvoraId();
      user = await User.create({
        clerkId,
        akvoraId,
        email: clerkEmail?.toLowerCase() || '',
        emailVerified: true,
        profileCompleted: false,
        registeredYear: year
      });
    }

    // Store image in ProfileImage collection
    // Check if image already exists for this user
    let profileImage = await ProfileImage.findOne({ userId: user._id });

    if (profileImage) {
      profileImage.data = req.file.buffer;
      profileImage.contentType = req.file.mimetype;
      profileImage.updatedAt = Date.now();
      await profileImage.save();
    } else {
      await ProfileImage.create({
        userId: user._id,
        data: req.file.buffer,
        contentType: req.file.mimetype
      });
    }

    // Construct the API URL for the image
    const avatarUrl = `${req.protocol}://${req.get('host')}/api/users/avatar/${user._id}`;

    // Update user record
    user.avatarUrl = avatarUrl;
    if (!user.profileCompleted) {
      user.profileCompleted = true;
    }
    await user.save();

    res.json({
      success: true,
      avatarUrl,
      user: {
        clerkId: user.clerkId,
        akvoraId: user.akvoraId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        certificateName: user.certificateName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        profileCompleted: user.profileCompleted,
        registeredYear: user.registeredYear
      }
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
}

/**
 * Get user avatar
 */
export async function getAvatar(req, res) {
  try {
    const { userId } = req.params;

    const profileImage = await ProfileImage.findOne({ userId });

    if (!profileImage || !profileImage.data) {
      // Redirect to default placeholder or return 404
      // Returning 404 allows frontend to show fallback
      return res.status(404).send('Image not found');
    }

    res.set('Content-Type', profileImage.contentType);
    res.send(profileImage.data);
  } catch (error) {
    console.error('Get avatar error:', error);
    res.status(500).send('Error fetching image');
  }
}



