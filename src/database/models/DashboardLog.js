// src/database/models/DashboardLog.js
const { Schema, model } = require('mongoose');

/**
 * Logs persistidos do dashboard
 * - para não perder logs ao reiniciar
 */
const dashboardLogSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },

  user: {
    id: { type: String, default: null },
    tag: { type: String, default: null }
  },

  executor: {
    id: { type: String, default: null },
    tag: { type: String, default: null }
  },

  guild: {
    id: { type: String, required: true },
    name: { type: String, default: '' }
  },

  time: { type: Date, default: Date.now }
}, { timestamps: true });

dashboardLogSchema.index({ 'guild.id': 1, time: -1 });

module.exports = model('DashboardLog', dashboardLogSchema);

