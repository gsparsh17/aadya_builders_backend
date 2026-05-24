const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Load env vars first!
dotenv.config();

const oneSignalService = require('./src/utils/onesignal.service');
const Notification = require('./src/modules/notifications/notification.model');
const User = require('./src/modules/users/user.model');
const Property = require('./src/modules/properties/property.model');



async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const allUsers = await User.find({ isActive: true });
    const property = await Property.findOne().sort({ createdAt: -1 });
    
    if (allUsers.length === 0 || !property) {
      console.log('Error: Need at least 1 user and 1 property in DB');
      process.exit(1);
    }

    console.log(`Broadcasting to ${allUsers.length} Users...`);
    console.log(`Recommending Property: ${property.title}`);

    const title = "🔥 New Property Match!";
    const message = `We found a new property: ${property.title} in ${property.location.city} that matches your interests.`;
    const payload = { type: 'recommendation', relatedId: property._id.toString() };

    // 1. Save to DB for all users
    const notifications = allUsers.map(u => ({
      recipient: u._id,
      title,
      message,
      type: 'recommendation',
      relatedId: property._id
    }));
    await Notification.insertMany(notifications);
    console.log('Saved to DB for all users!');

    // 2. Send Broadcast Push Notification via OneSignal
    await oneSignalService.sendBroadcastNotification(title, message, payload);
    console.log('Broadcast Push Notification Sent to OneSignal!');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
