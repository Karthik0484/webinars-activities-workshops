import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    // Clerk ID is optional (for admin users who don't use Clerk)
    required: false,
    unique: true,
    sparse: true, // Only enforce uniqueness for documents that have clerkId
    index: true
  },
  akvoraId: {
    type: String,
    unique: true,
    sparse: true
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: ''
  },
  certificateName: {
    type: String,
    default: ''
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  registeredYear: {
    type: Number
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  password: {
    type: String,
    default: ''
  },
  authProvider: {
    type: String,
    enum: ['email', 'google', 'github', 'clerk'],
    default: 'email'
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'BLOCKED', 'DELETED'],
    default: 'ACTIVE'
  },
  blockReason: {
    type: String,
    default: ''
  },
  blockedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);



