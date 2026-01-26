import WorkshopRegistration from '../models/WorkshopRegistration.js';
import User from '../models/User.js';
import Event from '../models/Event.js';

/**
 * Register for a workshop with UPI reference
 */
export async function registerForWorkshop(req, res) {
    try {
        const { clerkId } = req;
        const { workshopId, nameOnCertificate, upiReference } = req.body;

        if (!clerkId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!workshopId || !nameOnCertificate || !upiReference) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Find the user in our database
        const user = await User.findOne({ clerkId });
        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Find the workshop
        const workshop = await Event.findById(workshopId);
        if (!workshop) {
            return res.status(404).json({ error: 'Workshop not found' });
        }

        // Check if already registered
        const existingRegistration = await WorkshopRegistration.findOne({
            user: user._id,
            workshop: workshopId
        });

        if (existingRegistration) {
            // If the previous registration was rejected, allow re-registration
            if (existingRegistration.paymentStatus === 'REJECTED') {
                existingRegistration.upiReference = upiReference;
                existingRegistration.status = 'pending';
                existingRegistration.paymentStatus = 'PENDING';
                existingRegistration.rejectionReason = '';
                existingRegistration.rejectedAt = null;
                existingRegistration.nameOnCertificate = nameOnCertificate;

                await existingRegistration.save();

                return res.status(200).json({
                    success: true,
                    message: 'Re-registration submitted successfully. Pending verification.',
                    registration: existingRegistration
                });
            }
            return res.status(400).json({ error: 'You have already registered for this workshop' });
        }

        // Check if UPI reference is already used (to prevent duplicate payments)
        const duplicateUPI = await WorkshopRegistration.findOne({ upiReference });
        if (duplicateUPI) {
            return res.status(400).json({ error: 'This UPI reference number has already been used' });
        }

        // Check if Workshop is free (price is 0 or null)
        const isFree = !workshop.price || workshop.price === 0;
        const initialStatus = isFree ? 'approved' : 'pending';
        const initialPaymentStatus = isFree ? 'APPROVED' : 'PENDING';

        // Create new registration
        const registration = await WorkshopRegistration.create({
            user: user._id,
            workshop: workshopId,
            nameOnCertificate,
            upiReference: isFree ? `FREE-${Date.now()}` : upiReference, // Generate dummy Ref for free events
            status: initialStatus,
            paymentStatus: initialPaymentStatus
        });

        // If free/approved, add to Event's participants list immediately
        if (isFree) {
            const isAlreadyParticipant = workshop.participants.some(
                p => p.userId === user.clerkId
            );

            if (!isAlreadyParticipant) {
                workshop.participants.push({
                    userId: user.clerkId,
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    registeredAt: new Date()
                });
                await workshop.save();
            }
        }

        // Socket.IO Real-time Updates
        const io = req.app.get('io');
        if (io) {
            // Notify Admin (New Registration)
            io.to('admin').emit('registration:new', {
                type: 'workshop',
                eventId: workshopId,
                user: {
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email,
                    userId: user.clerkId,
                    akvoraId: user.akvoraId
                },
                status: initialStatus,
                upiReference: isFree ? 'FREE' : upiReference
            });

            // Notify User
            io.to(`user:${user.clerkId}`).emit('registration:status-updated', {
                eventId: workshopId,
                status: initialStatus,
                paymentStatus: initialPaymentStatus,
                meetingLink: isFree ? workshop.meetingLink : undefined
            });
        }

        res.status(201).json({
            success: true,
            message: 'Registration submitted successfully. Pending verification.',
            registration
        });
    } catch (error) {
        console.error('Workshop registration error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Duplicate registration or UPI reference' });
        }
        res.status(500).json({ error: 'Failed to submit registration' });
    }
}

/**
 * Get current user's registrations
 */
export async function getMyRegistrations(req, res) {
    try {
        const { clerkId } = req;
        const user = await User.findOne({ clerkId });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const registrations = await WorkshopRegistration.find({ user: user._id })
            .populate('workshop', 'title date type status imageUrl price meetingLink')
            .sort({ createdAt: -1 });

        // Sanitize: Only show meetingLink if status is approved AND paymentStatus is APPROVED
        const sanitizedRegistrations = registrations.map(reg => {
            const regObj = reg.toObject();
            if (regObj.status !== 'approved' || regObj.paymentStatus !== 'APPROVED') {
                if (regObj.workshop) {
                    regObj.workshop.meetingLink = undefined;
                }
            }
            return regObj;
        });

        res.json({
            success: true,
            registrations: sanitizedRegistrations
        });
    } catch (error) {
        console.error('Get my registrations error:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
}

/**
 * Get all registrations for a specific workshop (Admin)
 */
export async function getWorkshopRegistrations(req, res) {
    try {
        const { workshopId } = req.params;

        const registrations = await WorkshopRegistration.find({ workshop: workshopId })
            .populate('user', 'firstName lastName email akvoraId certificateName')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            registrations
        });
    } catch (error) {
        console.error('Get workshop registrations error:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
}

/**
 * Update registration status (Admin)
 */
export async function updateRegistrationStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, adminMessage } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const registration = await WorkshopRegistration.findById(id).populate('user workshop');
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        registration.status = status;

        // Update paymentStatus based on status
        if (status === 'approved') {
            registration.paymentStatus = 'APPROVED';
            registration.rejectionReason = '';
            registration.rejectedAt = null;
        } else if (status === 'rejected') {
            registration.paymentStatus = 'REJECTED';
            registration.rejectionReason = req.body.rejectionReason || adminMessage || 'Rejected by admin';
            registration.rejectedAt = new Date();
        } else if (status === 'pending') {
            registration.paymentStatus = 'PENDING';
        }

        if (adminMessage !== undefined) {
            registration.adminMessage = adminMessage;
        }

        await registration.save();

        // If approved, add to Event's participants list
        if (status === 'approved') {
            const event = await Event.findById(registration.workshop);
            const user = await User.findById(registration.user);

            if (event && user) {
                // Check if already in participants
                const isAlreadyParticipant = event.participants.some(
                    p => p.userId === user.clerkId
                );

                if (!isAlreadyParticipant) {
                    event.participants.push({
                        userId: user.clerkId,
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`,
                        registeredAt: new Date()
                    });
                    await event.save();
                }
            }
        }

        // Create notification for user
        const { createNotification } = await import('./notificationController.js');
        const user = registration.user;
        const workshop = registration.workshop;

        const notificationTitle = status === 'approved'
            ? `✅ Registration Approved`
            : status === 'rejected'
                ? `❌ Registration Rejected`
                : `⏳ Registration Status Updated`;

        const notificationMessage = status === 'approved'
            ? `Your registration for "${workshop.title}" has been approved! You're all set.`
            : status === 'rejected'
                ? `Your registration for "${workshop.title}" was rejected. Reason: ${registration.rejectionReason}`
                : `Your registration status for "${workshop.title}" has been updated to ${status}.`;

        await createNotification(
            user.clerkId,
            status === 'approved' ? 'approval' : status === 'rejected' ? 'rejection' : 'registration',
            notificationTitle,
            notificationMessage,
            {
                relatedEvent: workshop._id,
                relatedRegistration: registration._id,
                url: `/workshops`
            }
        );

        // Emit Socket.IO event to user
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${user.clerkId}`).emit('registration:status-updated', {
                registrationId: registration._id,
                eventId: workshop._id, // Add eventId for consistency
                status,
                paymentStatus: registration.paymentStatus, // Include payment status
                workshop: {
                    id: workshop._id,
                    title: workshop.title
                },
                message: notificationMessage,
                meetingLink: status === 'approved' ? workshop.meetingLink : undefined // Send meeting link if approved
            });

            // Emit to admin for participant count update
            io.to('admin').emit('stats:updated', {
                type: 'registration',
                action: status,
                eventId: workshop._id
            });
        }

        res.json({
            success: true,
            message: `Registration ${status} successfully`,
            registration
        });
    } catch (error) {
        console.error('Update registration status error:', error);
        res.status(500).json({ error: 'Failed to update registration status' });
    }
}

/**
 * Get user participation history (Webinars, Workshops, Internships)
 */
export async function getUserParticipationHistory(req, res) {
    try {
        const { clerkId } = req;
        const user = await User.findOne({ clerkId });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 1. Get Workshop Registrations (from WorkshopRegistration model)
        const workshopRegistrations = await WorkshopRegistration.find({ user: user._id })
            .populate('workshop', 'title type date endDate status imageUrl instructor')
            .sort({ createdAt: -1 });

        const workshops = workshopRegistrations.map(reg => {
            // Map status for frontend display
            let displayStatus = 'Registered';
            if (reg.status === 'approved') displayStatus = 'Approved';
            else if (reg.status === 'rejected') displayStatus = 'Rejected';
            else if (reg.status === 'pending') displayStatus = 'Pending';

            return {
                id: reg.workshop?._id,
                title: reg.workshop?.title,
                type: 'workshop',
                status: displayStatus,
                date: reg.workshop?.date,
                endDate: reg.workshop?.endDate,
                imageUrl: reg.workshop?.imageUrl,
                instructor: reg.workshop?.instructor, // Include instructor
                registrationStatus: reg.status
            };
        });

        // 2. Get Events Participation (Webinars, Internships)
        // Find events where the user is in the participants array
        const events = await Event.find({
            'participants.userId': clerkId,
            type: { $in: ['webinar', 'internship'] }
        }).select('title type date endDate status imageUrl participants instructor meetingLink').sort({ date: -1 });

        const webinars = [];
        const internships = [];
        const now = new Date();

        events.forEach(event => {
            // Find specific participant record
            const participant = event.participants.find(p => p.userId === clerkId);

            // Determine status based on dates
            let eventStatus = 'Registered';
            if (event.endDate && new Date(event.endDate) < now) {
                eventStatus = 'Completed';
            }

            // Get registration status from participant record
            // Default to 'approved' for backward compatibility with old records
            const registrationStatus = participant ? (participant.status || 'approved') : 'approved';

            const item = {
                id: event._id,
                title: event.title,
                type: event.type,
                status: eventStatus,
                date: event.date,
                endDate: event.endDate,
                imageUrl: event.imageUrl,
                instructor: event.instructor, // Include instructor
                // Only include meeting link if status is approved
                meetingLink: registrationStatus === 'approved' ? event.meetingLink : undefined,
                registeredAt: participant ? participant.registeredAt : null,
                registrationStatus: registrationStatus
            };

            if (event.type === 'webinar') {
                webinars.push(item);
            } else if (event.type === 'internship') {
                internships.push(item);
            }
        });

        res.json({
            success: true,
            history: {
                workshops,
                webinars,
                internships
            }
        });

    } catch (error) {
        console.error('Get participation history error:', error);
        res.status(500).json({ error: 'Failed to fetch participation history' });
    }
}


