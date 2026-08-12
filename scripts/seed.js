const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/modules/users/user.model');
const BoostPlan = require('../src/modules/boost/boostPlan.model');

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

    const boostPlans = [
      { name: '1 Day Boost', description: 'Quick visibility boost', price: 9, durationDays: 1, multiplier: 2, isActive: true },
      { name: '3 Days Boost', description: 'Improve property visibility for 3 days', price: 29, durationDays: 3, multiplier: 3, isActive: true },
      { name: '7 Days Boost', description: 'Improve property visibility for 7 days', price: 59, durationDays: 7, multiplier: 3, isActive: true },
      { name: '15 Days Boost', description: 'Improve property visibility for 15 days', price: 119, durationDays: 15, multiplier: 3, isActive: true },
      { name: '30 Days Boost', description: 'Improve property visibility for 30 days', price: 199, durationDays: 30, multiplier: 4, isActive: true }
    ];

    for (const plan of boostPlans) {
      await BoostPlan.findOneAndUpdate({ name: plan.name }, plan, { upsert: true, new: true });
    }
    console.log('Boost plans seeded successfully.');

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