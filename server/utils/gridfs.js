import mongoose from 'mongoose';
import { Readable } from 'stream';

let bucket;

const getBucket = () => {
    if (!bucket) {
        bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'uploads'
        });
    }
    return bucket;
};

export const uploadToGridFS = (buffer, originalName, mimeType) => {
    return new Promise((resolve, reject) => {
        try {
            const bucket = getBucket();
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalName}`;
            const uploadStream = bucket.openUploadStream(filename, {
                contentType: mimeType
            });

            const readStream = new Readable();
            readStream.push(buffer);
            readStream.push(null);

            readStream.pipe(uploadStream)
                .on('error', (error) => {
                    reject(error);
                })
                .on('finish', () => {
                    resolve({
                        id: uploadStream.id,
                        filename: filename,
                        contentType: mimeType
                    });
                });
        } catch (error) {
            reject(error);
        }
    });
};

export const deleteFromGridFS = async (fileId) => {
    if (!fileId) return;
    try {
        const bucket = getBucket();
        const _id = new mongoose.Types.ObjectId(fileId);
        await bucket.delete(_id);
        return true;
    } catch (error) {
        console.error('Error deleting file from GridFS:', error);
        return false;
    }
};
