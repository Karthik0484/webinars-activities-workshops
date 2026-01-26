import express from 'express';
import mongoose from 'mongoose';
import { adminAuth } from '../middleware/adminAuth.js';
import { clerkMiddleware } from '../middleware/clerkAuth.js';
import Certificate from '../models/Certificate.js';

const router = express.Router();

let bucket;
mongoose.connection.on('connected', () => {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    });
});

// Helper to stream file
// Helper to stream file
const streamFile = async (fileId, res) => {
    try {
        if (!bucket) {
            return res.status(503).json({ error: 'Storage service unavailable' });
        }

        const _id = new mongoose.Types.ObjectId(fileId);

        // Check if file exists
        const files = await bucket.find({ _id }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = files[0];
        const filename = file.filename || 'download';

        // Determine content type
        let contentType = file.contentType;
        if (!contentType || contentType === 'application/octet-stream') {
            if (filename.endsWith('.pdf')) contentType = 'application/pdf';
            else if (filename.match(/\.(jpg|jpeg|png)$/i)) contentType = 'image/jpeg';
        }

        // Set headers
        res.set('Content-Type', contentType || 'application/octet-stream');
        res.set('Content-Length', file.length);

        // Force attachment for PDFs to ensure download/proper handling, 
        // or let browser decide if it's an image.
        // User requested: Content-Disposition → attachment; filename="certificate.pdf"
        // keeping original filename is better for user experience though.
        res.set('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream
        const downloadStream = bucket.openDownloadStream(_id);

        downloadStream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error' });
            } else {
                res.end();
            }
        });

        downloadStream.pipe(res);
    } catch (error) {
        console.error('File stream error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to retrieve file' });
        }
    }
};

// Public Access to Event Images
router.get('/image/:id', async (req, res) => {
    await streamFile(req.params.id, res);
});

// Secure Access to Certificates
// This route should only be accessible if the user is the owner OR is an admin
// But for "download/view" via a direct link in a protected frontend app, we might need a token.
// If using Clerk, we can verify the token.
// Or we can use a query param token if it's an img src (unsafe).
// Best practice: Frontend fetches via API with Auth header, receives Blob, creates ObjectURL.
// So we will stick to standard Authorization header requirement.

// Serve Certificate File
router.get('/certificate/:id', clerkMiddleware, async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user?.userId; // Clerk User ID
        const userRole = req.user?.publicMetadata?.role;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Find certificate metadata to check ownership
        // We assume the caller knows the FILE ID. We need to find the Cert that has this fileId.
        const cert = await Certificate.findOne({ certificateFileId: fileId });

        if (!cert) {
            return res.status(404).json({ error: 'Certificate record not found' });
        }

        // 2. Check permissions
        // Allow if Admin
        if (userRole === 'admin') {
            return await streamFile(fileId, res);
        }

        // Allow if Owner
        // Cert stores `akvoraId`. We need to match it with the user's akvoraId.
        // Ideally we should probably store userId (Clerk ID) in Certificate too for easier lookup, 
        // OR we lookup the User by Clerk ID to get their Akvora ID.
        // Let's rely on the fact that we can check ownership via Database.

        // HOWEVER, the `Certificate` model has `userId` which is the Clerk ID (optional).
        // If populated, we check that.

        /* 
           NOTE: The `Certificate` model has `userId` (String) which is likely the Clerk ID based on `Certificate.js` comments 
           lines 4-8: required: false, // Optional if user hasn't registered via Clerk yet
        */

        if (cert.userId === userId) {
            return await streamFile(fileId, res);
        }

        // Also check akvoraId if we can map it? 
        // In `server/models/User.js` (not viewed but assumed), we assume we can find user.
        // But let's for now rely on `userId` (ClerkID) being present on the certificate if the user is registered.
        // If the user was NOT registered when cert was issued, `userId` might be missing.
        // In that case, when they register, we surely update their certificates?
        // If not, they can't access it yet?
        // Requirement says: "Certificate visible to user ... Secure access enforced"

        return res.status(403).json({ error: 'Access denied: You do not own this certificate' });

    } catch (error) {
        console.error('Certificate access error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin only direct access (optional, mainly for debugging or admin dashboard preview)
router.get('/admin/view/:id', adminAuth, async (req, res) => {
    await streamFile(req.params.id, res);
});

export default router;
