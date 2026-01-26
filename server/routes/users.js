import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { clerkMiddleware } from '../middleware/clerkAuth.js';
import { createOrUpdateProfile, getProfile, getAkvoraId, updateAvatar, getAvatar } from '../controllers/userController.js';

const router = express.Router();

// Multer setup for avatar uploads - Changed to MemoryStorage for MongoDB persistence
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// Avatar endpoints - Public access for <img src> tags
router.get('/avatar/:userId', getAvatar);

// All user routes require authentication
router.use(clerkMiddleware);

router.post('/create-profile', createOrUpdateProfile);
router.get('/profile', getProfile);
router.put('/profile', createOrUpdateProfile);

// Avatar upload with explicit Multer error handling
router.post('/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max size is 2MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    updateAvatar(req, res, next);
  });
});
router.get('/akvora-id/:clerkId', getAkvoraId);

export default router;



