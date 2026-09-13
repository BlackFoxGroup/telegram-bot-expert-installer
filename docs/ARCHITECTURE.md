# Telegram Bot Expert Installer — Architecture

## Goal

A local web Expert that installs and manages a Telegram bot on a Linux VPS.
The operator uses a browser only. Linux commands stay on the server side.

## Modes

- **Webhook**: domain + DNS + HTTPS + reverse proxy + Telegram `setWebhook`.
- **Polling**: no domain/SSL required. systemd long polling.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Desktop-first wizard and dashboard |
| Backend | Fastify + TypeScript | SSH, jobs, file upload, SSE |
| SSH | `ssh2` | Real remote exec / SFTP |
| Store | Encrypted JSON on disk | Secrets stay server-side |
| Tests | Vitest | Unit + mocked SSH + E2E design |

## Security model

- Master key: `data/master.key` (AES-256-GCM).
- Bot token, SSH password, and private keys are encrypted at rest.
- UI shows masked secrets only (`123456:**************abcd`).
- Logs pass through a redactor before persist or stream.
- Secrets never go into query strings or `localStorage`.
- Session id is an opaque cookie/header; credentials live in the backend session store.

## Process flow

```
Browser  →  Fastify API  →  SshManager  →  VPS
                ↓
         JobEngine (progress + rollback)
                ↓
   Detector / Deps / Deploy / Service / Webhook|Polling / Health
```

## File map

```
apps/server/src
  security/     crypto, mask, redactor
  ssh/          connect, exec, sftp
  vps/          detect, package manager, firewall
  installer/    job engine, steps, rollback
  telegram/     token + webhook API
  service/      systemd
  health/       checks + auto-repair
  backup/       archive + restore
  update/       backup → deploy → health → rollback
  routes/       HTTP + SSE
apps/web/src    wizard, dashboard, logs, health
packages/shared types shared by UI and API
```
