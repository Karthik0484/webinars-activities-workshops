import multer from 'multer';

// Use memory storage to process files before saving to GridFS manually
export const storage = multer.memoryStorage();

export default storage;
