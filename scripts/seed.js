const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/modules/users/user.model');

const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      'mongodb://localhost:27017/aadya_builders';

    await mongoose.connect(mongoUri);

    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminData = {
      name: process.env.ADMIN_NAME || 'Super Admin',
      email: (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
      phone: process.env.ADMIN_PHONE || '9876543666',
      password: process.env.ADMIN_PASSWORD || 'Test@1234',
      role: 'admin',
      isActive: true,
      isBlocked: false,
      isVerified: true,
      emailVerified: true,
      phoneVerified: true,
      acceptTerms: true,
      subscription: {
        listingsRemaining: 999999,
        isActive: true
      }
    };

    const existingAdmin = await User.findOne({ email: adminData.email });

    if (existingAdmin) {
      existingAdmin.name = adminData.name;
      existingAdmin.phone = adminData.phone;
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      existingAdmin.isBlocked = false;
      existingAdmin.isVerified = true;
      existingAdmin.emailVerified = true;
      existingAdmin.phoneVerified = true;

      if (adminData.password) {
        existingAdmin.password = adminData.password;
      }

      await existingAdmin.save();

      console.log('Admin user already existed. Updated successfully.');
      console.log(`Email: ${existingAdmin.email}`);
    } else {
      const admin = await User.create(adminData);

      console.log('Admin user created successfully.');
      console.log(`Email: ${admin.email}`);
    }

    await mongoose.connection.close();
    console.log('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);

    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();