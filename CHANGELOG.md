# Changelog

Todas as alterações relevantes deste projeto serão documentadas neste ficheiro.

O formato segue uma aproximação ao [Keep a Changelog](https://keepachangelog.com/) e utiliza versionamento semântico inspirado em [SemVer](https://semver.org/).

---

## [v1.0.13] – Dashboard & UX refinements

### Adicionado
- Badge **Bot online/offline** no topo da dashboard, alimentado pelo endpoint `/health`.
- Mini-painéis na tab **Hub de moderação**:
  - Resumo de ações de moderação nas últimas 24h.
  - Painel de últimos tickets (24h).
  - Estrutura preparada para painel de "utilizadores mais tempo online" por intervalo (24h / 7d / 30d / 1 ano).
- Endpoint `/api/mod/overview` no backend para fornecer estatísticas rápidas de moderação e tickets.

### Alterado
- Tab **GameNews** alinhada com o padrão master-detail usado em Utilizadores (lista à esquerda + painel de detalhe à direita).
- Painel de **Voz temporária** (Extras) ajustado para ter mini-painel de detalhe visualmente consistente com o resto da UI.
- Dashboard atualizada para:
  - Reutilizar mais componentes de layout (`user-layout`, mini-paineis).
  - Garantir que, em caso de erro 401, o utilizador é devolvido ao ecrã de login.

### Corrigido
- Remoção da antiga tab **Cases** e respetiva lógica legacy no frontend.
- Erros de sintaxe em `dashboard.js` causados por ramos de tabs obsoletos.
- Problemas de CSS em `dashboard.css` (regra solta que afetava a secção GameNews).
- Vários pontos de scroll horizontal indesejado, especialmente no painel de Voz Temporária.

---

## [v1.0.0] – Primeira versão pública

### Adicionado
- Bot Discord com:
  - Comandos de moderação (`warn`, `mute`, `unmute`, `clear`, `userinfo`, `help`).
  - Integração com MongoDB para registo de infrações.
- Dashboard web inicial:
  - Visão geral do servidor.
  - Tabs de Utilizadores, Logs, Tickets, GameNews e Configuração.
- Sistema de GameNews baseado em RSS.
- Sistema de canais de Voz Temporária com configuração guardada em MongoDB.
- Configuração base em `defaultConfig.js` e integração com variáveis `.env`.

---

## Histórico anterior

Versões intermédias (ex: 1.0.1–1.0.12) focaram-se sobretudo em:

- Ajustes incrementais de UI na dashboard.
- Pequenas correções ao fluxo de tickets e logs.
- Melhorias na robustez do bot (tratamento de erros, estados de conexão, etc.).

Para detalhes finos dessas versões, consultar o histórico de commits.
