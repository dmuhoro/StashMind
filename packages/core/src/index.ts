/**
 * @stashmind/core — Shared core package
 *
 * Re-exports StashMind's domain logic so both StashMind (Next.js/Gemini)
 * and EasyTutor (React Native/Expo/Ollama) can share the same core.
 */

// Config
export {
  MODELS,
  type ModelId,
  TTS_PROVIDER_DUAL_HOST,
  type TtsProvider,
  PROMPT_VERSIONS,
  AUDIENCE_PRESETS,
  type AudiencePreset,
  LESSON_STYLES,
  type LessonStyle,
  LESSON_LENGTHS,
  type LessonLengthMinutes,
  LANGUAGES,
  type LessonLanguage,
  QUOTAS,
  FEATURE_FLAGS,
  HTTP_CLIENT_HEADERS,
  MODEL_ROUTER,
  LOCAL_TTS,
  isDailySpendKillSwitchActive,
  isValidAudiencePreset,
  isValidLessonStyle,
} from '../../../src/config/index.ts';

// Database types
export type {
  UserTier,
  SourceType,
  LessonStatus,
  PracticeMode,
  PracticeSessionStatus,
  WorkspaceRole,
  Profile,
  Workspace,
  WorkspaceMember,
  Source,
  HostDialogueLine,
  LessonSectionMarker,
  Lesson,
  Card,
  SavedCard,
  PracticeTurn,
  PracticeScorecard,
  PracticeSession,
  UsageCounter,
  ApiKeyRecord,
  WebhookRecord,
  WebhookDeliveryRecord,
  AuditLogRecord,
} from '../../../src/db/types.ts';

// Security
export { SecurityService } from '../../../src/services/security.ts';

// Cache
export { CacheService } from '../../../src/services/cache.ts';

// Crypto
export { sha256, hmacSha256, secureCompare } from '../../../src/services/crypto.ts';

// Retention
export {
  RetentionEngine,
  type ReviewGrade,
} from '../../../src/services/retentionEngine.ts';
export type { Streak, SpacedReview } from '../../../src/db/types.ts';

// Practice
export {
  PracticeEngine,
  PRESET_SCENARIOS,
  type PracticeScenarioDefinition,
} from '../../../src/services/practiceEngine.ts';

// Export
export { ExportEngine } from '../../../src/services/exportEngine.ts';

// Model Router (Tier 2)
export { ModelRouter, type ModelProvider, type GenerationRequest, type GenerationResult } from '../../../src/services/modelRouter.ts';

// Local TTS (Tier 2)
export {
  LocalTtsService,
  type LocalTtsEngine,
  type LocalTtsConfig,
  type LocalTtsResult,
} from '../../../src/services/localTts.ts';
