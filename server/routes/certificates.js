import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { adminAuth } from '../middleware/adminAuth.js';
import { clerkMiddleware } from '../middleware/clerkAuth.js';
import {
    uploadCertificate,
    getMyCertificates,
    getAllCertificates,
    verifyUserForCertificate,
    getUserCertificatesByAkvoraId,
    updateCertificate,
    deleteCertificate
} from '../controllers/certificateController.js';
import { storage } from '../config/storage.js';

const router = express.Router();

// Multer setup for certificate uploads


const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept images and PDFs
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'));
        }
    }
});

// Admin routes
router.post('/upload', adminAuth, upload.single('certificate'), uploadCertificate);
router.post('/check-user', adminAuth, verifyUserForCertificate);
router.get('/all', adminAuth, getAllCertificates);
router.get('/user/:akvoraId', adminAuth, getUserCertificatesByAkvoraId);
router.put('/:id', adminAuth, updateCertificate);
router.delete('/:id', adminAuth, deleteCertificate);

// User routes
router.get('/my', clerkMiddleware, getMyCertificates);

export default router;
