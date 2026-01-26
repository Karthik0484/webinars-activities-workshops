import express from 'express';
import { clerkMiddleware } from '../middleware/clerkAuth.js';
import { adminAuth } from '../middleware/adminAuth.js';
import {
    registerForEvent,
    getMyRegistrations,
    getEventRegistrations,
    updateRegistrationStatus,
    getUserParticipationHistory
} from '../controllers/registrationController.js';

const router = express.Router();

// User routes
router.post('/', clerkMiddleware, registerForEvent);
router.get('/my', clerkMiddleware, getMyRegistrations);
router.get('/history', clerkMiddleware, getUserParticipationHistory);

// Admin routes
router.get('/event/:workshopId', adminAuth, getEventRegistrations);
router.put('/:id/status', adminAuth, updateRegistrationStatus);

export default router;
