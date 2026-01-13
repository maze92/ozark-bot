const express = require('express');
const http = require('http');
const { logCache } = require('./systems/logger');

const app = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server);

// Tornar acessível para o logger enviar logs em tempo real
module.exports.io = io;

// Servir ficheiros estáticos (HTML, CSS, JS)
app.use(express.static('public'));

// Endpoint simples para verificar se o bot está online
app.get('/status', (req, res) => {
  res.json({ status: 'online' });
});

// Conexão Socket.IO
io.on('connection', (socket) => {
  // Enviar logs atuais ao cliente
  socket.emit('logs', logCache);

  // Solicitação de logs atualizados
  socket.on('requestLogs', () => {
    socket.emit('logs', logCache);
  });
});

module.exports = server;

