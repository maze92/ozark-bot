# Changelog

Todas as alterações relevantes deste projeto são documentadas neste ficheiro.

O projeto segue **Semantic Versioning** (`MAJOR.MINOR.PATCH`)  
e boas práticas inspiradas em **Keep a Changelog**.

---

## [1.6.2] – 2026-01-19
### Dashboard Tickets & Cases Filters

#### Added
- Nova tab **Tickets** no dashboard para listar tickets (`!ticket`) com paginação server-side.
- Filtro por **status** (OPEN/CLOSED) e **User ID** nos tickets.
- Botão **Close ticket** diretamente no painel (fecha no Mongo e tenta ajustar o canal no Discord).
- Filtro por **source** na tab **Cases** (command / slash / dashboard / automod / antispam).

#### Changed
- Cards de cases agora mostram também o `source` como badge para debugging/auditoria mais rápida.

#### Fixed
- Pequenos ajustes de paginação e limites por página para manter o dashboard responsivo em servidores grandes.

## [1.6.1] – 2026-01-19
### Dashboard UX & Per-Guild Admin

#### Added
- Endpoint `/api/guilds/:guildId/meta` para o dashboard obter **canais + roles** do servidor.
- Seletor multi-role no separador **Config** para definir `staffRoleIds` por servidor.
- Botão **Clear** no topo para limpar rapidamente o token guardado no browser.

#### Changed
- Melhor feedback visual quando o token é inválido (badge **Auth** passa a "Token inválido").

#### Fixed
- Carregamento das opções de configuração por servidor (canais/roles) mais robusto.

## [1.6.0] – 2026-01-19
### Escalonamento de Punições, Auditoria & Tickets

#### Added
- Escalonamento automático de punições no WARN (prefix + slash), respeitando Trust.
- Campo `source` no modelo de infrações para auditoria (slash/command/automod/antispam/dashboard).
- Sistema de **tickets/modmail** simples (`!ticket` e `!ticketclose`) com persistência em Mongo.


## [1.0.2] – 2026-01-17
### Infrastructure, Stability & Compatibility

#### Added
- Sistema global de estado da aplicação (`status service`) para monitorização centralizada:
  - Estado do Discord (clientReady)
  - Estado da ligação ao MongoDB
  - Estado do sistema GameNews
- Endpoint `/health` para integração com plataformas de deploy e monitorização.
- Integração total do estado da aplicação no dashboard web.

#### Changed
- Migração definitiva para o evento `clientReady`, garantindo compatibilidade com:
  - `discord.js` v14.25+
  - futura versão v15
- Fluxo de arranque centralizado em `src/index.js`, assegurando ordem correta de:
  - ligação ao MongoDB
  - inicialização do Discord
  - registo de Slash Commands
  - arranque do GameNews
- Definição explícita do runtime suportado (`Node.js 20.x`) em `package.json`.

#### Fixed
- Situações em que Slash Commands ou GameNews não arrancavam corretamente em produção.
- Estados inconsistentes reportados no dashboard em caso de falha parcial de serviços.
- Problemas de deploy em plataformas como Railway devido a inicialização prematura.

---

## [1.0.1] – 2026-01-15
### AutoMod Improvements & Code Cleanup

#### Added
- AutoMod 2.1 com normalização avançada de texto:
  - remoção de acentos (PT/EN)
  - mitigação de bypass por caracteres especiais
- Respostas de Slash Commands configuradas como **ephemerais** para melhor UX do staff.

#### Changed
- Limpeza de dependências:
  - remoção de `node-fetch` (não utilizado).
- Melhorias gerais de logging e mensagens de erro.

#### Fixed
- Casos onde palavras ofensivas com acentos escapavam ao filtro.
- Pequenos comportamentos inesperados em Node.js 20.

---

## [1.0.0] – 2026-01-10
### Initial Stable Release

#### Added
- Sistema completo de **Moderação Automática**.
- Sistema de **Trust Score persistente** por utilizador.
- Gestão de infrações:
  - WARN
  - MUTE / TIMEOUT
  - UNMUTE
- Anti-Spam com timeout automático.
- RSS **Game News** com:
  - deduplicação real por hash
  - retry com backoff e jitter
  - persistência no MongoDB
- Dashboard web em tempo real (Express + Socket.IO).
- Comandos de texto e Slash Commands.

---

### Versioning Notes
- `PATCH` → correções e melhorias internas
- `MINOR` → novas funcionalidades compatíveis
- `MAJOR` → mudanças incompatíveis ou refactors estruturais
