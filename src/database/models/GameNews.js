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
    default: null  // 'null' para indicar que o campo ainda não foi preenchido
  }
}, { timestamps: true }); // Adiciona os campos 'createdAt' e 'updatedAt'

// Criar um índice único para 'source' se não estiver sendo gerado corretamente
gameNewsSchema.index({ source: 1 }, { unique: true });

// Exporta o modelo
module.exports = model('GameNews', gameNewsSchema);
