const { Schema, model } = require('mongoose');

// Esquema para armazenar a última notícia enviada de cada feed
const gameNewsSchema = new Schema({
  source: {        // Nome do feed (ex: "Polygon_PC", "IGN_PC")
    type: String,
    required: true,
    unique: true    // Garante que cada feed tenha apenas um registro
  },
  lastHash: {      // Hash da última notícia enviada
    type: String,
    default: null  // 'null' indica que ainda não foi enviada nenhuma notícia
  }
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

// Exporta o modelo para uso em gamenews.js
module.exports = model('GameNews', gameNewsSchema);
