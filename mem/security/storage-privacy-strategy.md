---
name: Storage privacy strategy
description: Which buckets are public vs private and how to read each — required reading before touching storage call sites
type: constraint
---

## Bucket classification (LOCKED)

**Public distribution** — keep `public:true`, use `getPublicUrl()`:
- `thumbnails`, `video-thumbnails` — gallery previews
- `final-videos`, `videos` — public-completed shareable outputs
- `avatars` — used in public showcase
- `scene-images` — embedded in public project pages
- `temp-frames` — short-lived, internal

**Owner-private** — `public:false`, use `useSignedAsset()` / `createSignedUrl()`:
- `enterprise-brand-kits`, `genesis-castings`, `hoppy-uploads` (already private)
- `character-references` (LOCKED PRIVATE 2026-05-16 — face/biometric data; folder convention `{userId}/...` enforced by RLS; reads via signed URLs only; admins can read via `has_role`)
- `user-uploads`, `voice-tracks`, `brand-assets`, `photo-edits` (still public — flip when call sites are migrated)

## Rules
- Folder convention: `{userId}/...` — required for owner RLS policy to work.
- Never persist `getPublicUrl()` output for an owner-private bucket; persist the storage path and resolve via `useSignedAsset()` on read.
- When flipping a bucket private, audit every persisted DB column that stored its URL; re-sign on read or migrate to path-only storage first.
- Do NOT flip a bucket private in the same migration as a code change — coordinate over two deploys (add signed-resolution → ship → flip bucket).