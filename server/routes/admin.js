import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { verifyAdminToken } from '../middleware/adminAuth.js';
import { 
  getEmailPasswordUsers, 
  blockUser, 
  unblockUser, 
  deleteUser,
  getAllUserProfiles
} from '../controllers/adminController.js';

const router = express.Router();

// Admin login route (bypasses Clerk authentication)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const adminEmail = email.toLowerCase();
    const defaultAdminEmail = 'admin@akvora.com';
    const defaultAdminPassword = 'admin123';

    // Find admin user
    let adminUser = await User.findOne({ 
      email: adminEmail, 
      role: 'admin' 
    });

    // If admin user doesn't exist, create it
    if (!adminUser) {
      // Only create default admin user for the default email
      if (adminEmail !== defaultAdminEmail) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
      const currentYear = new Date().getFullYear();

      adminUser = await User.create({
        email: defaultAdminEmail,
        role: 'admin',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        emailVerified: true,
        profileCompleted: true,
        registeredYear: currentYear
        // Note: clerkId and akvoraId are optional for admin users
      });
    }

    // If admin user exists but password is missing, set the default password
    if (!adminUser.password) {
      const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
      adminUser.password = hashedPassword;
      await adminUser.save();
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: adminUser._id, 
        email: adminUser.email, 
        role: adminUser.role 
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: adminUser._id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        akvoraId: adminUser.akvoraId,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all email/password registered users (Admin only)
router.get('/users', verifyAdminToken, getEmailPasswordUsers);

// Block a user (Admin only)
router.put('/users/:id/block', verifyAdminToken, blockUser);

// Unblock a user (Admin only)
router.put('/users/:id/unblock', verifyAdminToken, unblockUser);

// Delete a user permanently (Admin only)
router.delete('/users/:id', verifyAdminToken, deleteUser);

// Get all user profiles (Admin only)
router.get('/user-profiles', verifyAdminToken, getAllUserProfiles);

export default router;
