// Seeds the database with a fixed set of tables and one admin account.
// Run with: npm run seed
require('dotenv').config();
const connectDB = require('./config/db');
const Table = require('./models/Table');
const User = require('./models/User');
const mongoose = require('mongoose');

const seed = async () => {
  await connectDB();

  await Table.deleteMany({});
  await Table.insertMany([
    { tableNumber: 1, capacity: 2 },
    { tableNumber: 2, capacity: 2 },
    { tableNumber: 3, capacity: 4 },
    { tableNumber: 4, capacity: 4 },
    { tableNumber: 5, capacity: 6 },
    { tableNumber: 6, capacity: 8 },
  ]);
  console.log('Tables seeded.');

  const adminEmail = 'admin@restaurant.com';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: 'Restaurant Admin',
      email: adminEmail,
      password: 'admin123', // change after first login in a real deployment
      role: 'admin',
    });
    console.log(`Admin account created: ${adminEmail} / admin123`);
  } else {
    console.log('Admin account already exists, skipping.');
  }

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
