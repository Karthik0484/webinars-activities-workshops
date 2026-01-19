import express from 'express';
import { verifyClerkToken } from '../middleware/clerkAuth.js';
import { verifyAdminToken } from '../middleware/adminAuth.js';
import { checkUserStatus } from '../middleware/checkUserStatus.js';
import {
    registerForWorkshop,
    getMyRegistrations,
    getWorkshopRegistrations,
    updateRegistrationStatus
} from '../controllers/registrationController.js';

const router = express.Router();

// User routes - block blocked users from registering
router.post('/', verifyClerkToken, checkUserStatus, registerForWorkshop);
router.get('/my', verifyClerkToken, checkUserStatus, getMyRegistrations);

// Admin routes
router.get('/event/:workshopId', verifyAdminToken, getWorkshopRegistrations);
router.put('/:id/status', verifyAdminToken, updateRegistrationStatus);

export default router;
