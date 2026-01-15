// src/database/connect.js
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ Missing MONGO_URI (or MONGODB_URI) in environment');
} else {
  mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
}
