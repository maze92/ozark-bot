# Ozark Bot

Discord bot com dashboard web moderno, focado em **moderação**, **inspeção rápida de atividade** e **gestão de conteúdos** (tickets, GameNews, canais de voz temporários), preparado para deploy em serviços como Railway.

> Versão atual: **v1.0.13**

---

## ✨ Principais funcionalidades

### 🔧 Moderação com histórico centralizado

- Comandos de moderação (slash) integrados com o dashboard:
  - `warn`, `mute`, `unmute`, `clear`, `userinfo`, `help` (e outros que venhas a adicionar).
- Histórico de ações acessível na tab **Hub de moderação**:
  - Filtros por tipo de ação (warn, mute, ban, tickets, etc.).
  - Pesquisa por utilizador, moderador ou detalhe.
- Mini-painéis de resumo (dashboard):
  - **Análises do servidor (24h)** – distribuição de ações de moderação nas últimas 24 horas.
  - **Últimos tickets (24h)** – visão rápida dos tickets mais recentes.

> A lógica de logs é servida via `/api/logs` e, quando disponível, via modelo `DashboardLog` em MongoDB.

---

### 🎫 Sistema de Tickets

- Criação e gestão de tickets diretamente a partir do Discord.
- Integração com a dashboard:
  - Listagem de tickets.
  - Acompanhamento do estado (aberto/fechado) através de logs de moderação.
- Preparado para integração com `TicketLog` em MongoDB (quando configurado).

---

### 👤 Tab de Utilizadores

- Lista de utilizadores do servidor (com paginação a nível de API recomendada para servidores grandes).
- Mini-painel de **histórico de moderação por utilizador**:
  - Avisos, mutes, bans, etc.
  - Ações rápidas (warn, unmute, reset) com feedback imediato.
- Indicadores de confiança ("trust") por utilizador, pensados para dar contexto rápido ao staff.

---

### 📰 GameNews (feeds RSS de jogos)

- Gestão de feeds RSS específicos para notícias de jogos.
- Para cada feed podes:
  - Definir o canal onde as notícias são publicadas.
  - Controlar intervalos de leitura e estados.
- Integração com o backend via `/gamenews/feeds` e `/gamenews/status`.

A tab **GameNews** foi reestruturada para usar o mesmo padrão de UI que a tab de Utilizadores (lista à esquerda + painel de detalhe à direita).

---

### 🔊 Canais de Voz Temporários

- Configuração de canais base para criação de canais temporários de voz.
- Opções de:
  - IDs de canais base.
  - Delay/timeout.
  - Comportamento de criação/eliminação.

Interface:

- Painel no separador **Extras** com:
  - Lista à esquerda de canais base configurados.
  - Mini-painel de detalhe à direita, alinhado visualmente com o resto da dashboard.

Dados persistidos em MongoDB através do modelo `TempVoiceChannel`.

---

### 🌐 Dashboard Web

- Construída em HTML/CSS/JS puro (sem frameworks pesadas).
- Estrutura principal:
  - `public/index.html` – layout de tabs.
  - `public/js/dashboard.js` – core da dashboard (estado, helpers, navegação).
  - Módulos adicionais:
    - `public/js/dashboard.moderation.js`
    - `public/js/dashboard.users.js`
    - `public/js/dashboard.gamenews.js`
- Internacionalização simples:
  - Picker de idioma (`pt` / `en`).
  - Textos carregados via função `t(key)` e dicionário `i18n`.
- Indicador de estado do bot:
  - Badge **Bot online/offline** no topo, alimentado pelo endpoint `/health` (Discord + Mongo).

---

## 🧱 Arquitetura geral

### Backend (Node.js + Express + Discord.js)

- Entry point: `src/index.js`
- Configuração:
  - `src/config/defaultConfig.js` – opções de dashboard, staff roles, tickets, GameNews, etc.
  - Variáveis de ambiente via `.env` (exemplo abaixo).
- Dashboard:
  - `src/dashboard.js` – liga o Express ao frontend:
    - `/api/guilds`, `/api/logs`, `/api/users`, `/api/tickets`, `/api/mod/overview`, etc.
    - `/health` – usado pelo badge de estado.
- Base de dados:
  - MongoDB via Mongoose.
  - Modelos em `src/database/models/` (ex: `Infraction`, `TempVoiceChannel`, etc.).
- Bot Discord:
  - `src/events/` / `src/slash/` – organização por eventos e comandos.
  - Uso de `discord.js` v14.

### Frontend (Dashboard)

- **Core**: `public/js/dashboard.js`
  - Gestão de tabs.
  - Estado global (`state`).
  - Helpers de API (`apiGet`, `apiPost`) com tratamento de **401 → volta ao login**.
  - i18n e toasts.
- **Módulos específicos**:
  - `dashboard.moderation.js` – logs, mini-painéis de moderação.
  - `dashboard.users.js` – lista de utilizadores + histórico.
  - `dashboard.gamenews.js` – gestão de feeds e estados.
- **Estilos**:
  - `public/css/dashboard.css` – tema escuro, layouts master-detail, mini-paineis, responsividade.

---

## ⚙️ Requisitos

- **Node.js**: 20.x (ver `engines` em `package.json`).
- **MongoDB**: instância acessível (local ou remota).
- Ambiente de build/execução compatível com:
  - `discord.js` ^14.25.1
  - `express` ^5.x
  - `mongoose` ^9.x

---

## 📦 Instalação e execução (desenvolvimento)

1. Clonar o repositório:

   ```bash
   git clone https://github.com/maze92/ozark-bot.git
   cd ozark-bot
   ```

2. Instalar dependências:

   ```bash
   npm install
   ```

3. Criar `.env` com as variáveis necessárias, por exemplo:

   ```bash
   DISCORD_TOKEN=seu_token_do_bot
   MONGO_URI=mongodb://localhost:27017/ozark-bot
   DASHBOARD_TOKEN=uma_chave_secreta_para_login
   PORT=3000
   ```

4. Iniciar em modo produção simples:

   ```bash
   npm start
   ```

   Por omissão, o servidor Express arranca e o bot liga-se à gateway do Discord.

---

## 🚀 Deploy (ex: Railway)

O projeto foi pensado para funcionar bem em plataformas tipo **Railway**:

- `npm start` como comando principal.
- `PORT` lido do ambiente.
- `MONGO_URI` deve apontar para uma base de dados acessível externamente.
- Certifica-te que o `DISCORD_TOKEN` está definido como variável de ambiente no serviço.

---

## 🌍 Internacionalização (i18n)

- Os textos na dashboard são mapeados via `data-i18n` ou pela função `t(key)` em JavaScript.
- Idiomas suportados:
  - `pt` – Português.
  - `en` – Inglês.
- O seletor de idioma (`#langPicker`) controla a língua ativa.
- Novas traduções podem ser adicionadas diretamente no objeto `i18n` em `public/js/dashboard.js`.

---

## 🧹 Qualidade e manutenção

- Evita adicionar texto “hardcoded” diretamente no HTML/JS – sempre que possível, usa `t('chave')`.
- Prefere **template literals** em JavaScript a concatenações clássicas:
  - ✅ ``
  - ❌ `'User: ' + username`

- Mantém o `CHANGELOG.md` atualizado sempre que fizeres alterações relevantes:
  - APIs novas.
  - Alterações visíveis na UI.
  - Quebras de compatibilidade (breaking changes).

---

## 📜 Licença

Projeto licenciado sob **ISC**, conforme definido em `package.json`.

Sente-te à vontade para adaptar, reutilizar e contribuir melhorias.
