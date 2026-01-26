import Certificate from '../models/Certificate.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import { createNotification } from './notificationController.js';
import mongoose from 'mongoose';
import { uploadToGridFS, deleteFromGridFS } from '../utils/gridfs.js';

export const uploadCertificate = async (req, res) => {
    try {
        const { akvoraId, eventId, certificateTitle } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Certificate file is required' });
        }

        // Find user by Akvora ID
        const user = await User.findOne({ akvoraId });
        if (!user) {
            return res.status(404).json({ error: 'User with this Akvora ID not found' });
        }

        // Verify event exists (optional)
        if (eventId && eventId !== 'undefined' && eventId !== 'null') {
            try {
                const event = await Event.findById(eventId);
                if (!event) return res.status(404).json({ error: 'Event not found' });
            } catch (e) {
                // ignore invalid object id 
            }
        }

        // Upload to GridFS
        const fileResult = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype);

        // Construct file URL
        const certificateUrl = `/api/files/certificate/${fileResult.id}`;
        const certificateFileId = fileResult.id;

        // Create or update certificate
        // Check ifCertificate already exists for this user and event
        // Only if eventId is provided (manual uploads get new entries)
        let existingCert = null;
        if (eventId && eventId !== 'undefined' && eventId !== 'null') {
            existingCert = await Certificate.findOne({
                userId: user.clerkId,
                eventId: eventId
            });
        }

        let certificate;
        if (existingCert) {
            // Update existing
            if (existingCert.certificateFileId) {
                await deleteFromGridFS(existingCert.certificateFileId);
            }
            existingCert.certificateUrl = certificateUrl;
            existingCert.certificateFileId = certificateFileId;
            existingCert.certificateTitle = certificateTitle || existingCert.certificateTitle;
            certificate = await existingCert.save();
        } else {
            // Create new
            certificate = await Certificate.create({
                userId: user.clerkId || undefined, // undefined if not registered on Clerk
                eventId: (eventId && eventId !== 'undefined' && eventId !== 'null') ? eventId : null,
                akvoraId: user.akvoraId,
                certificateTitle: certificateTitle || 'Certificate of Achievement',
                certificateUrl,
                certificateFileId
            });
        }

        // Create notification ONLY if user has Clerk ID
        if (user.clerkId) {
            await createNotification(
                user.clerkId,
                'approval',
                '🎓 New Certificate Available!',
                `A new certificate has been uploaded for you.`,
                {
                    url: '/my-certificates',
                    relatedEvent: eventId
                }
            );

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(`user:${user.clerkId}`).emit('certificate:issued', {
                    certificate,
                    message: 'New certificate received!'
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Certificate uploaded successfully',
            certificate
        });

    } catch (error) {
        console.error('Upload certificate error details:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
            file: req.file ? { orig: req.file.originalname, mime: req.file.mimetype } : 'No file'
        });
        res.status(500).json({ error: 'Failed to upload certificate', details: error.message });
    }
};

export const getMyCertificates = async (req, res) => {
    try {
        const { clerkId } = req;

        // Find user to get akvoraId
        const user = await User.findOne({ clerkId });

        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Find certificates by userId OR akvoraId
        const certificates = await Certificate.find({
            $or: [
                { userId: clerkId },
                { akvoraId: user.akvoraId }
            ]
        })
            .populate('eventId', 'title date type')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            certificates
        });
    } catch (error) {
        console.error('Get certificates error:', error);
        res.status(500).json({ error: 'Failed to fetch certificates' });
    }
};

export const getAllCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.find()
            .populate('eventId', 'title')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            certificates
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const verifyUserForCertificate = async (req, res) => {
    try {
        const { akvoraId } = req.body;

        if (!akvoraId) {
            return res.status(400).json({ error: 'Akvora ID is required' });
        }

        const user = await User.findOne({ akvoraId });

        if (!user) {
            return res.status(404).json({ error: 'User not found with this Akvora ID' });
        }

        res.json({
            success: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                akvoraId: user.akvoraId,
                clerkId: user.clerkId
            }
        });
    } catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({ error: 'Failed to verify user' });
    }
};

export const getUserCertificatesByAkvoraId = async (req, res) => {
    try {
        const { akvoraId } = req.params;

        // Verify user exists first to get clean error if not found
        const user = await User.findOne({ akvoraId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const certificates = await Certificate.find({ akvoraId })
            .populate('eventId', 'title')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                akvoraId: user.akvoraId
            },
            certificates
        });
    } catch (error) {
        console.error('Get user certificates error:', error);
        res.status(500).json({ error: 'Failed to fetch user certificates' });
    }
};

export const updateCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const { certificateTitle } = req.body;

        if (!certificateTitle) {
            return res.status(400).json({ error: 'Certificate title is required' });
        }

        const certificate = await Certificate.findByIdAndUpdate(
            id,
            { certificateTitle },
            { new: true }
        );

        if (!certificate) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        res.json({
            success: true,
            message: 'Certificate updated successfully',
            certificate
        });
    } catch (error) {
        console.error('Update certificate error:', error);
        res.status(500).json({ error: 'Failed to update certificate' });
    }
};

export const deleteCertificate = async (req, res) => {
    try {
        const { id } = req.params;

        const certificate = await Certificate.findById(id);

        if (!certificate) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        // Delete from GridFS if fileId exists
        if (certificate.certificateFileId) {
            await deleteFromGridFS(certificate.certificateFileId);
        }
        // Legacy file cleanup
        else if (certificate.certificateUrl && certificate.certificateUrl.includes('/uploads/certificates/')) {
            // Logic to delete local file (skipped for now as per previous logic, or can be added if crucial)
        }

        await Certificate.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Certificate deleted successfully'
        });
    } catch (error) {
        console.error('Delete certificate error:', error);
        res.status(500).json({ error: 'Failed to delete certificate' });
    }
};
