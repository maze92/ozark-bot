/**
 * Criação da instância principal do Discord Client
 * Aqui definimos:
 * - Intents (eventos que o bot pode receber)
 * - Partials (dados parciais que podem ser carregados depois)
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({

  /**
   * Intents:
   * Definem que tipos de eventos o bot vai receber do Discord
   */
  intents: [
    GatewayIntentBits.Guilds,           // Servidores (obrigatório)
    GatewayIntentBits.GuildMessages,    // Mensagens em servidores
    GatewayIntentBits.MessageContent,   // Conteúdo das mensagens (AutoMod / comandos)
    GatewayIntentBits.GuildMembers      // Membros (warns, mute, joins)
  ],

  /**
   * Partials:
   * Permitem lidar com dados incompletos (ex: mensagens antigas, canais não cacheados)
   */
  partials: [
    Partials.Channel,   // Necessário para mensagens em canais não carregados
    Partials.Message,   // Boa prática para AutoMod
    Partials.GuildMember,
    Partials.User
  ]
});

module.exports = client;
