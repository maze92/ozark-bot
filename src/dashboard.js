const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./database/models/User');
const GameNews = require('./database/models/GameNews');

const app = express();

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Servir assets estáticos (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// ==============================
// Rota principal – Dashboard
// ==============================
app.get('/', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$messages" } } }
    ]);

    res.render('index', {
      totalUsers,
      totalMessages: totalMessages[0]?.total || 0,
      uptime: process.uptime()
    });
  } catch (err) {
    console.error('[Dashboard] Error / route:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ==============================
// Infractions
// ==============================
app.get('/infractions', async (req, res) => {
  try {
    const users = await User.find().sort({ warnings: -1 }).limit(50);
    res.render('infractions', { users });
  } catch (err) {
    console.error('[Dashboard] Error /infractions route:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ==============================
// Game News Stats
// ==============================
app.get('/gamenews', async (req, res) => {
  try {
    const feeds = await GameNews.find().sort({ updatedAt: -1 });
    res.render('gamenews', { feeds });
  } catch (err) {
    console.error('[Dashboard] Error /gamenews route:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;
