import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: false, // Optional if user hasn't registered via Clerk yet
        index: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: false
    },
    akvoraId: {
        type: String,
        required: true,
        index: true
    },
    certificateUrl: {
        type: String,
        required: true
    },
    certificateFileId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    certificateTitle: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    issuedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index just in case we want to ensure unique per user-event, 
// though requirements say "One certificate per event per user"
// Compound index removed to allow multiple manual certificates (eventId: null)
// certificateSchema.index({ userId: 1, eventId: 1 }, { unique: true, sparse: true });

const Certificate = mongoose.model('Certificate', certificateSchema);

export default Certificate;
