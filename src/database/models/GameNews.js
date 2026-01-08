const { Schema, model } = require('mongoose');

// Definição do esquema para armazenar as notícias do feed
const gameNewsSchema = new Schema({
  source: {         // Nome do feed (ex: "Polygon_PC", "IGN_PC")
    type: String,
    required: true,
    unique: true,    // Garante que o nome do feed seja único
  },
  lastLink: {       // URL da última notícia enviada
    type: String,
    default: undefined  // Deixe o valor como undefined ao invés de null
  }
}, { timestamps: true }); // Adiciona os campos 'createdAt' e 'updatedAt'

// Exporta o modelo
module.exports = model('GameNews', gameNewsSchema);

