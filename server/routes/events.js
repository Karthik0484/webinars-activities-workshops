import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// Multer setup for event image uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads', 'events');

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});



// Custom upload middleware to handle errors
const uploadMiddleware = (req, res, next) => {
  upload.single('eventImage')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max size is 5MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Helper to parse list fields from FormData
const parseListField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  // If it's a string containing commas (for tags) or just a string
  return field.split(',').map(item => item.trim()).filter(item => item);
};

// Admin routes (all require admin authentication)

// Create new event
router.post('/', adminAuth, uploadMiddleware, async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.admin.userId
    };

    // Handle list fields that might come as strings from FormData
    if (typeof req.body.tags === 'string') {
      eventData.tags = parseListField(req.body.tags);
    }
    if (typeof req.body.requirements === 'string') {
      eventData.requirements = parseListField(req.body.requirements);
    }
    if (typeof req.body.whatYouWillLearn === 'string') {
      eventData.whatYouWillLearn = parseListField(req.body.whatYouWillLearn);
    }

    // Add image URL if image was uploaded
    if (req.file) {
      eventData.imageUrl = `/uploads/events/${req.file.filename}`;
    }

    const event = new Event(eventData);
    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get all events (admin view with full details)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    const now = new Date();

    if (type) filter.type = type;

    // Filter by calculated status based on dates
    if (status) {
      if (status === 'completed') {
        // Event is completed if endDate is in the past
        filter.endDate = { $lt: now };
      } else if (status === 'active') {
        // Event is active (upcoming or ongoing) if endDate is in the future
        filter.endDate = { $gte: now };
      }
    }

    const events = await Event.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ date: status === 'completed' ? -1 : 1 }); // Sort completed by newest first, active by soonest first

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Convert event to object to allow modification
    const eventObj = event.toObject();

    // If event has participants, fetch their Akvora IDs
    if (eventObj.participants && eventObj.participants.length > 0) {
      const userIds = eventObj.participants.map(p => p.userId);
      const users = await User.find({ clerkId: { $in: userIds } }).select('clerkId akvoraId');

      // Create a map of clerkId -> akvoraId
      const userMap = {};
      users.forEach(u => {
        userMap[u.clerkId] = u.akvoraId;
      });

      // Attach akvoraId to each participant
      eventObj.participants = eventObj.participants.map(p => ({
        ...p,
        akvoraId: userMap[p.userId] || 'N/A'
      }));
    }

    res.json({
      success: true,
      event: eventObj
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Update event
router.put('/:id', adminAuth, uploadMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if admin created this event
    if (event.createdBy.toString() !== req.admin.userId) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    const updateData = { ...req.body };

    // Handle list fields
    if (typeof req.body.tags === 'string') {
      updateData.tags = parseListField(req.body.tags);
    }
    if (typeof req.body.requirements === 'string') {
      updateData.requirements = parseListField(req.body.requirements);
    }
    if (typeof req.body.whatYouWillLearn === 'string') {
      updateData.whatYouWillLearn = parseListField(req.body.whatYouWillLearn);
    }

    // Add image URL if new image was uploaded
    if (req.file) {
      updateData.imageUrl = `/uploads/events/${req.file.filename}`;

      // Delete old image if it exists
      if (event.imageUrl && event.imageUrl.startsWith('/uploads/events/')) {
        const oldImagePath = path.join(__dirname, '..', event.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if admin created this event
    if (event.createdBy.toString() !== req.admin.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Register for event
router.post('/:eventId/register', async (req, res) => {
  try {
    const { userId, userEmail, userName } = req.body;

    if (!userId || !userEmail) {
      return res.status(400).json({ error: 'User ID and email are required' });
    }

    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is already registered
    const isAlreadyRegistered = event.participants.some(
      participant => participant.userId === userId
    );

    if (isAlreadyRegistered) {
      return res.status(400).json({ error: 'Already registered for this event' });
    }

    // Determine status based on price
    const isFree = !event.price || event.price === 0;
    const initialStatus = isFree ? 'approved' : 'pending';
    const initialPaymentStatus = isFree ? 'APPROVED' : 'PENDING';

    // Add user to participants
    event.participants.push({
      userId,
      email: userEmail,
      name: userName || 'User',
      registeredAt: new Date(),
      status: initialStatus,
      paymentStatus: initialPaymentStatus
    });

    await event.save();

    // Socket.IO Real-time Updates
    const io = req.app.get('io');
    if (io) {
      // Notify Admin (New Registration)
      io.to('admin').emit('registration:new', {
        type: event.type,
        eventId: event._id,
        user: {
          name: userName || 'User',
          email: userEmail,
          userId: userId
        },
        status: initialStatus
      });

      // Notify User (Status Update / Registration Success)
      io.to(`user:${userId}`).emit('registration:status-updated', {
        eventId: event._id,
        status: initialStatus,
        paymentStatus: initialPaymentStatus,
        meetingLink: isFree ? event.meetingLink : undefined
      });
    }

    res.json({
      success: true,
      message: isFree ? 'Successfully registered for event' : 'Registration submitted. Pending approval.',
      participantCount: event.participants.length,
      status: initialStatus
    });
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({ error: 'Failed to register for event' });
  }
});

// Unregister from event
router.delete('/:eventId/unregister', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Remove user from participants
    event.participants = event.participants.filter(
      participant => participant.userId !== userId
    );

    await event.save();

    res.json({
      success: true,
      message: 'Successfully unregistered from event',
      participantCount: event.participants.length
    });
  } catch (error) {
    console.error('Event unregistration error:', error);
    res.status(500).json({ error: 'Failed to unregister from event' });
  }
});

// Get event statistics
router.get('/stats/dashboard', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const stats = await Event.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalParticipants: { $sum: { $size: '$participants' } },
          upcoming: {
            $sum: {
              $cond: [{ $gt: ['$date', now] }, 1, 0]
            }
          }
        }
      }
    ]);


    const totalEvents = await Event.countDocuments();
    const totalParticipants = await Event.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $size: '$participants' } }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalEvents,
        totalParticipants: totalParticipants[0]?.total || 0,
        byType: stats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Update participant status (for Webinars/Internships)
router.put('/:eventId/participants/:userId/status', adminAuth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const { eventId, userId } = req.params;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const participantIndex = event.participants.findIndex(p => p.userId === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Update status
    event.participants[participantIndex].status = status;

    // Update payment status based on status
    if (status === 'approved') {
      event.participants[participantIndex].paymentStatus = 'APPROVED';
    } else if (status === 'rejected') {
      event.participants[participantIndex].paymentStatus = 'REJECTED';
    } else {
      event.participants[participantIndex].paymentStatus = 'PENDING';
    }

    await event.save();

    // Socket.IO Real-time Updates
    const io = req.app.get('io');
    if (io) {
      // Notify User
      io.to(`user:${userId}`).emit('registration:status-updated', {
        eventId: event._id,
        status: status,
        paymentStatus: event.participants[participantIndex].paymentStatus,
        meetingLink: status === 'approved' ? event.meetingLink : undefined,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined
      });

      // Notify Admin (Stats Update)
      io.to('admin').emit('stats:updated', {
        type: event.type,
        eventId: event._id
      });
    }

    // Send notification
    // Note: In a real app, we would import createNotification here
    // For now, we'll assume the frontend handles polling or the user sees it on refresh

    res.json({
      success: true,
      message: `Participant status updated to ${status}`,
      participant: event.participants[participantIndex]
    });
  } catch (error) {
    console.error('Update participant status error:', error);
    res.status(500).json({ error: 'Failed to update participant status' });
  }
});

export default router;
