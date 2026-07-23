# Analyst Hermes Extension

Status: replicated dry-run extension, not installed  
Date: 2026-06-28  
Scope: publication-safe Hermes workflow preparation for Analyst.

## Boundary

This extension prepares Hermes-style workflow packets for source refresh, article QA, publication gates, and transcript/evidence return. It does not create a Discord bot, run a Hermes gateway, install runtime state, or publish content.

Preserve Markdown/CSV/JSON provenance and HTML derivative boundary. Article previews and reader HTML are derivative until rebuilt from approved Markdown and ledgers.

## Validate

```bash
python3 11-hermes/scripts/validate_hermes_setup.py
```
