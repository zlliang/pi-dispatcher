# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-08-08

Initial release of pi-dispatcher, a Pi extension that chooses the model and thinking level best suited to each session.

### Added

- One-time dispatch before the first model request, preserving prompt-cache continuity
- Configurable model candidates, thinking levels, hints, and dedicated dispatcher model
- Layered global and project configuration and dispatch rules
- Decisions informed by model capabilities, pricing, session context, and the initial request
- Cancellable dispatch with a 15-second timeout and safe fallback to the current model
- Expandable session entries showing the selected model, thinking level, and rationale

[0.1.0]: https://github.com/zlliang/pi-dispatcher/releases/tag/v0.1.0
