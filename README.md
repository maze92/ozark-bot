# Ozark Discord Bot

**Ozark** é um bot de Discord focado em **moderação automática**, **gestão de infrações**, **Trust Score**, **RSS Game News** e **dashboard web em tempo real**.

Foi concebido para servir como uma base **robusta, extensível e profissional**, adequada tanto para comunidades pequenas como para servidores de grande dimensão.

---

## ✨ Destaques

- Compatível com `discord.js` **v14.25+** (preparado para v15)
- AutoMod avançado com normalização de texto (PT / EN)
- Trust Score persistente e progressivo
- Dashboard web com monitorização em tempo real
- Preparado para produção (Railway, Docker, VPS)

---

## 🚀 Funcionalidades

### 🛡️ Moderação Automática
- Deteção de linguagem ofensiva com normalização de:
  - acentos
  - símbolos
  - variações comuns de bypass
- Warnings progressivos e automáticos
- Timeout baseado em Trust Score
- Anti-Spam com cooldown inteligente
- Exclusões por cargos (staff / admins)

### 🧠 Trust Score
- Score individual persistente por utilizador
- Penalizações automáticas por infrações
- Regeneração gradual ao longo do tempo
- Influência direta em:
  - número de avisos permitidos
  - duração dos mutes

### 📰 Game News (RSS)
- Leitura de múltiplos feeds RSS
- Deduplicação real por hash
- Retry com backoff e jitter
- Persistência em MongoDB
- Integração com dashboard e estado da aplicação

### 📊 Dashboard Web
- Express + Socket.IO
- Visualização de:
  - estado do bot
  - estado do MongoDB
  - estado do GameNews
  - Trust Score e infrações
- Endpoint `/health` para monitorização externa
- Autenticação por token (`DASHBOARD_TOKEN`)

### ⚙️ Comandos
- Comandos de texto (prefixo configurável)
- Slash Commands (`/warn`, `/mute`, `/unmute`, `/userinfo`, etc.)
- Respostas ephemerais para ações administrativas
- Lógica partilhada entre comandos texto e slash

---

## 🛠️ Requisitos

- **Node.js 20.x**
- MongoDB (local ou cloud)
- Bot criado no Discord Developer Portal com:
  - Message Content Intent
  - Guild Members Intent

---

## ⚙️ Configuração

### Variáveis de ambiente

Cria um ficheiro `.env`:

```env
TOKEN=discord_bot_token
MONGO_URI=mongodb_connection_string
DASHBOARD_TOKEN=secure_random_token
PORT=3000



### 🧵 Sistema de Tickets por Threads
- Mensagem fixa de suporte com reação 🎫 num canal configurável.
- Cada reação abre uma **thread privada** (`ticket-001`, `ticket-002`, ...).
- Embed inicial dentro da thread com botão via reação 🔒 para fechar o ticket.
- Logs de tickets integrados com o sistema de moderação e painel de histórico por utilizador.

### 👤 Histórico por Utilizador na Dashboard
- Nova área na tab **Utilizadores** com:
  - Resumo de infrações (WARN / MUTE / KICK / BAN)
  - Lista de ações recentes
  - Lista de tickets associados ao utilizador
- Ajuda moderadores a tomar decisões rápidas e consistentes.
