const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  trust: { type: Number, default: 30 },
  warnings: { type: Number, default: 0 },
  warnHistory: [ // Guarda histórico de infrações
    {
      word: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = model('User', userSchema);
