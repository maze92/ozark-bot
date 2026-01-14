// src/dashboard.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.send('Bot is running ✅');
});

// Logs em memória (temporário)
let logs = [];

// Socket.io connection
io.on('connection', (socket) => {
  console.log('🔌 New client connected to the dashboard');

  // Envia todos os logs ao conectar
  socket.emit('logs', logs);

  socket.on('requestLogs', () => {
    socket.emit('logs', logs);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected from the dashboard');
  });
});

/**
 * Envia um log para todos os clientes e salva na memória
 * @param {Object} log - { title, user, executor, description, time }
 */
function sendToDashboard(title, user, executor, description) {
  const logEntry = {
    title,
    user: user?.tag || null,
    executor: executor?.tag || null,
    description,
    time: Date.now()
  };

  // Adiciona à memória (últimos 100 logs)
  logs.push(logEntry);
  if (logs.length > 100) logs.shift();

  io.emit('logs', logs);
}

// Exporta app, server e função de envio de logs
module.exports = {
  app,
  server,
  sendToDashboard
};

