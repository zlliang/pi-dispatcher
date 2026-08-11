# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/zlliang/pi-dispatcher/compare/v0.1.0...v0.2.0) (2026-08-11)


### Features

* add dispatch magic instructions ([8f60996](https://github.com/zlliang/pi-dispatcher/commit/8f60996a53152e629d41b7aeacccee20a4df3eaa))
* record model preference in dispatch entry ([a47dfc9](https://github.com/zlliang/pi-dispatcher/commit/a47dfc9a4647e4637c0a57f5aa1a3c910cc9554f))


### Bug Fixes

* mute dispatch key hint parentheses ([11dbdde](https://github.com/zlliang/pi-dispatcher/commit/11dbdde4957791a652c7b17c0f298f050e7c4cdd))

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
