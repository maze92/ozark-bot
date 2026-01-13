const { Schema, model } = require('mongoose');

// Stores last sent news per feed
const gameNewsSchema = new Schema({
  source: {
    type: String,
    required: true,
    unique: true
  },
  lastHash: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = model('GameNews', gameNewsSchema);
