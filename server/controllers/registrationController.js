import WorkshopRegistration from '../models/WorkshopRegistration.js';
import User from '../models/User.js';
import Event from '../models/Event.js';

/**
 * Register for a workshop with UPI reference
 */
/**
 * Register for an event (Workshop, Webinar, etc.) with UPI reference
 */
export async function registerForEvent(req, res) {
    try {
        const { clerkId } = req;
        const { workshopId, nameOnCertificate, upiReference } = req.body;

        if (!clerkId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!workshopId || !nameOnCertificate) {
            return res.status(400).json({ error: 'Workshop ID and Name on Certificate are required' });
        }

        // Find the user in our database
        const user = await User.findOne({ clerkId });
        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Find the event
        const workshop = await Event.findById(workshopId);
        if (!workshop) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if Event is free (price is 0, null, or string "0")
        const isFree = !workshop.price || workshop.price == 0;

        // Validate UPI reference only for PAID events
        if (!isFree && !upiReference) {
            return res.status(400).json({ error: 'UPI Reference is required for paid events' });
        }

        // Check if already registered
        const existingRegistration = await WorkshopRegistration.findOne({
            user: user._id,
            workshop: workshopId
        });

        if (existingRegistration) {
            // If the previous registration was rejected, allow re-registration
            if (existingRegistration.paymentStatus === 'REJECTED') {
                existingRegistration.upiReference = isFree ? `FREE-${Date.now()}` : upiReference;
                existingRegistration.status = isFree ? 'approved' : 'pending';
                existingRegistration.paymentStatus = isFree ? 'APPROVED' : 'PENDING';
                existingRegistration.rejectionReason = '';
                existingRegistration.rejectedAt = null;
                existingRegistration.nameOnCertificate = nameOnCertificate;

                await existingRegistration.save();

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
                            registeredAt: new Date(),
                            status: 'approved',
                            paymentStatus: 'APPROVED'
                        });
                        await workshop.save();
                    }
                }

                return res.status(200).json({
                    success: true,
                    message: isFree ? 'Registration successful!' : 'Re-registration submitted. Pending verification.',
                    registration: existingRegistration
                });
            }
            return res.status(400).json({ error: 'You have already registered for this event' });
        }

        // Check if UPI reference is already used (only for PAID events)
        if (!isFree) {
            const duplicateUPI = await WorkshopRegistration.findOne({ upiReference });
            if (duplicateUPI) {
                return res.status(400).json({ error: 'This UPI reference number has already been used' });
            }
        }

        const initialStatus = isFree ? 'approved' : 'pending';
        const initialPaymentStatus = isFree ? 'APPROVED' : 'PENDING';

        // Create new registration
        const registration = await WorkshopRegistration.create({
            user: user._id,
            workshop: workshopId,
            nameOnCertificate,
            upiReference: isFree ? `FREE-${Date.now()}-${Math.floor(Math.random() * 1000)}` : upiReference, // Add random to ensure uniqueness
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
                    registeredAt: new Date(),
                    status: 'approved',
                    paymentStatus: 'APPROVED'
                });
                await workshop.save();
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration submitted successfully. Pending verification.',
            registration
        });
    } catch (error) {
        console.error('Event registration error:', error);
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

        // Sanitize: Map to object and include status for frontend logic
        const sanitizedRegistrations = registrations
            .map(reg => {
                const regObj = reg.toObject();
                // Security: Only expose meeting link if Approved
                if (reg.status !== 'approved' || reg.paymentStatus !== 'APPROVED') {
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
 * Get all registrations for a specific event (Admin)
 */
export async function getEventRegistrations(req, res) {
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
        console.error('Get event registrations error:', error);
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
                status,
                workshop: {
                    id: workshop._id,
                    title: workshop.title
                },
                message: notificationMessage
            });

            // Emit to admin for participant count update
            io.to('admin').emit('stats:updated', {
                type: 'registration',
                action: status
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

        // 1. Get ALL Registrations from WorkshopRegistration model (Unified source for payment/registration status)
        const allRegistrations = await WorkshopRegistration.find({ user: user._id })
            .populate('workshop', 'title type date endDate status imageUrl instructor meetingLink price')
            .sort({ createdAt: -1 });

        // Map keyed by event ID for easy lookup
        const registrationMap = new Map();
        allRegistrations.forEach(reg => {
            if (reg.workshop) {
                registrationMap.set(reg.workshop._id.toString(), reg);
            }
        });

        // 2. Get Events where user is in 'participants' list (Legacy + Free Auto-approved)
        const participantEvents = await Event.find({
            'participants.userId': clerkId
        }).select('title type date endDate status imageUrl participants instructor meetingLink price').sort({ date: -1 });

        // Helper to process an event item
        const processEvent = (eventObj, regDoc = null, participantDoc = null) => {
            const now = new Date();
            let eventStatus = 'Registered';
            if (eventObj.endDate && new Date(eventObj.endDate) < now) {
                eventStatus = 'Completed';
            }

            // Determine registration status
            // Priority: WorkshopRegistration status > Participant List status > 'approved' default
            let registrationStatus = 'approved';
            let meetingLink = undefined;

            if (regDoc) {
                registrationStatus = regDoc.status;
                if (registrationStatus === 'approved' && regDoc.paymentStatus === 'APPROVED') {
                    meetingLink = eventObj.meetingLink;
                }
            } else if (participantDoc) {
                registrationStatus = participantDoc.status || 'approved';
                if (registrationStatus === 'approved') {
                    meetingLink = eventObj.meetingLink;
                }
            }

            // Map status for frontend display label
            let displayStatus = 'Registered';
            if (registrationStatus === 'approved') displayStatus = 'Approved';
            else if (registrationStatus === 'rejected') displayStatus = 'Rejected';
            else if (registrationStatus === 'pending') displayStatus = 'Pending';

            return {
                id: eventObj._id,
                title: eventObj.title,
                type: eventObj.type,
                status: displayStatus, // UI Label
                date: eventObj.date,
                endDate: eventObj.endDate,
                imageUrl: eventObj.imageUrl,
                instructor: eventObj.instructor,
                meetingLink: meetingLink,
                registrationStatus: registrationStatus, // Technical status
                rejectionReason: regDoc ? regDoc.rejectionReason : null
            };
        };

        const workshops = [];
        const webinars = [];
        const internships = [];
        const processedEventIds = new Set();

        // Process from WorkshopRegistration first (covers Paid Pending/Approved/Rejected)
        allRegistrations.forEach(reg => {
            if (!reg.workshop) return;

            const eventId = reg.workshop._id.toString();
            if (processedEventIds.has(eventId)) return;

            const item = processEvent(reg.workshop, reg, null);

            if (reg.workshop.type === 'workshop') workshops.push(item);
            else if (reg.workshop.type === 'webinar') webinars.push(item);
            else if (reg.workshop.type === 'internship') internships.push(item);

            processedEventIds.add(eventId);
        });

        // Process leftovers from Event.participants (covers Free Auto-approved or Legacy that migrated without WorkshopRegistration)
        participantEvents.forEach(event => {
            const eventId = event._id.toString();
            if (processedEventIds.has(eventId)) return;

            const participant = event.participants.find(p => p.userId === clerkId);
            const item = processEvent(event, null, participant);

            if (event.type === 'workshop') workshops.push(item);
            else if (event.type === 'webinar') webinars.push(item);
            else if (event.type === 'internship') internships.push(item);

            processedEventIds.add(eventId);
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


