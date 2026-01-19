# Changelog

All notable changes to **Ozark Bot** are documented in this file.

The format follows **Keep a Changelog** and **Semantic Versioning** principles.

---

## [1.1.0] — 2026‑01‑19

### Added

* Scheduled maintenance system for automatic cleanup:

  * Old infractions pruning (default: 180 days)
  * Old dashboard logs pruning (default: 60 days)
* Runtime metrics:

  * Total commands executed
  * Total infractions created
  * Auto‑moderation actions
  * Anti‑spam actions
* Guild‑specific configuration (`GuildConfig`):

  * Custom log channel per guild
  * Custom staff role mapping
* Dashboard API endpoints for per‑guild configuration
* Actor tracking for dashboard moderation actions

  * Executor identity logged and stored with infractions

### Changed

* Dashboard health endpoint extended with metrics payload
* Logger enhanced to resolve log channels via guild configuration
* CORS handling made explicit and production‑safe

### Fixed

* Circular dependency between dashboard and logger
* Redundant MongoDB index definition in `GuildConfig`
* Minor stability issues in AutoMod / Anti‑Spam interaction

---

## [1.0.2] — 2026‑01‑17

### Added

* Game News system using RSS feeds
* Web dashboard with live logs and health status
* Anti‑spam detection with escalation logic
* Trust‑based Auto‑Moderation rules

### Changed

* Refactored MongoDB connection handling
* Improved global error handling via ErrorGuard

### Fixed

* Minor command handling edge cases
* Logging consistency improvements

---

## [1.0.0] — Initial Release

* Core Discord moderation commands
* MongoDB persistence for users and infractions
* Basic logging system
* Production‑ready project structure

---

**Note:**
Future versions will continue to prioritize stability, observability, and clean extensibility.
