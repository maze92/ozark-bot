const { Schema, model } = require('mongoose');

const gameNewsSchema = new Schema({
  source: {
    type: String,
    required: true,
    unique: true
  },
  lastHash: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = model('GameNews', gameNewsSchema);
