import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyClerkToken } from '../middleware/clerkAuth.js';
import { checkUserStatus } from '../middleware/checkUserStatus.js';
import { createOrUpdateProfile, getProfile, getAkvoraId, updateAvatar } from '../controllers/userController.js';

const router = express.Router();

// Multer setup for avatar uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

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

// All user routes require authentication
router.use(verifyClerkToken);

// Profile routes - allow blocked users to access these
router.post('/create-profile', createOrUpdateProfile);
router.get('/profile', getProfile);
router.put('/profile', createOrUpdateProfile);
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

// Other routes - block blocked users from accessing these
router.use(checkUserStatus);
router.get('/akvora-id/:clerkId', getAkvoraId);

export default router;



