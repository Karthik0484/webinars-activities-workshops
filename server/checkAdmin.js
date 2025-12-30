import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';

mongoose.connect('mongodb+srv://Aravind:Aravind%402041@cluster0.ykz5b.mongodb.net/Akvora_Webiners')
  .then(async () => {
    console.log('Connected to MongoDB');
    const admin = await User.findOne({ email: 'admin@akvora.com' });
    if (admin) {
      console.log('Admin user found:', {
        email: admin.email,
        role: admin.role,
        hasPassword: !!admin.password,
        passwordLength: admin.password?.length
      });
      
      // Test password verification
      const isValid = await bcrypt.compare('admin123', admin.password);
      console.log('Password verification test:', isValid);
    } else {
      console.log('Admin user not found');
    }
    mongoose.disconnect();
  })
  .catch(console.error);
