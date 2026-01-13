const { Schema, model } = require('mongoose');

const gameNewsSchema = new Schema({
  source: {
    type: String,
    required: true,
    unique: true
  },
  hashes: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = model('GameNews', gameNewsSchema);
