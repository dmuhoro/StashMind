# @stashmind/core

Shared core package used by both StashMind (Next.js/Gemini) and EasyTutor (React Native/Expo/Ollama).

## What's shared

- **Config**: Model IDs, quotas, feature flags, audience presets, lesson styles
- **Database types**: Profile, Lesson, Card, Streak, SpacedReview, ApiKeyRecord, etc.
- **Security**: SSRF protection, URL validation, HTML sanitization
- **Cache**: SHA-256 content hashing for deduplication
- **Crypto**: SHA-256, HMAC-SHA256, constant-time comparison
- **Retention**: Timezone streaks, weekly freeze, SM-2 spaced repetition
- **Practice**: Preset scenarios, roleplay definitions
- **Export**: Markdown, JSON, CSV (Anki) deck export

## Usage

```ts
import { MODELS, QUOTAS, RetentionEngine, CacheService } from '@stashmind/core';
```

## Install (in EasyTutor)

```bash
npm install /path/to/stashmind/packages/core
```
or add to workspace.
