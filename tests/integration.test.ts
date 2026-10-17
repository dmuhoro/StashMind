import { describe, it, expect } from 'vitest';
import { StashMindRepository } from '../src/db/repository.ts';
import { ApiKeyService } from '../src/services/apiKeys.ts';
import { WebhookService } from '../src/services/webhooks.ts';
import { McpServer } from '../src/services/mcpServer.ts';
import { OPENAPI_SPEC } from '../src/server/openapi.ts';
import { SEED_LESSONS } from '../src/services/seedData.ts';

describe('Integration Contract & RLS Isolation Tests (Part C & Phase 1)', () => {
  it('should enforce strict two-user RLS isolation on lessons and cards', async () => {
    const userA = 'user_alpha_123';
    const userB = 'user_beta_456';

    const repo = StashMindRepository.instance;

    // Create a lesson for User A
    const lessonA = {
      ...SEED_LESSONS[0].lesson,
      id: 'les_alpha_test',
      user_id: userA,
    };
    await repo.saveLesson(userA, lessonA);

    // User A can read own lesson
    const readByA = await repo.getLesson(userA, 'les_alpha_test');
    expect(readByA).not.toBeNull();
    expect(readByA?.id).toBe('les_alpha_test');

    // RLS ISOLATION CHECK: User B attempting to read User A's lesson must throw RLS_VIOLATION
    await expect(repo.getLesson(userB, 'les_alpha_test')).rejects.toThrowError(/RLS_VIOLATION/);

    // RLS ISOLATION CHECK: User B attempting to delete User A's lesson must throw RLS_VIOLATION
    await expect(repo.deleteLesson(userB, 'les_alpha_test')).rejects.toThrowError(/RLS_VIOLATION/);
  });

  it('should generate scoped API keys with visible prefix and verified hashes', async () => {
    const { plaintextKey, keyRecord } = await ApiKeyService.generateKey(
      'user_agent_tester',
      'Test Agent Key',
      ['lessons:read', 'lessons:write']
    );

    expect(plaintextKey.startsWith('stm_live_')).toBe(true);
    expect(keyRecord.key_prefix).toBe(plaintextKey.slice(0, 12));
    expect(keyRecord.key_hash).toBeDefined();

    // Verification check
    const verification = await ApiKeyService.verifyKey(plaintextKey, 'lessons:read');
    expect(verification.valid).toBe(true);
    expect(verification.userId).toBe('user_agent_tester');

    // Scope check: requesting unauthorized scope fails
    const scopeCheck = await ApiKeyService.verifyKey(plaintextKey, 'webhooks:manage');
    expect(scopeCheck.valid).toBe(false);
  });

  it('should compute valid HMAC-SHA256 signatures for outgoing webhooks', () => {
    const secret = 'whsec_test_secret_123';
    const timestamp = '2026-10-17T12:00:00Z';
    const payload = JSON.stringify({ event: 'lesson.ready', data: { lesson_id: 'les_1' } });

    const signature = WebhookService.computeSignature(secret, timestamp, payload);
    expect(signature.startsWith('sha256=')).toBe(true);

    // Tampered payload produces different signature
    const tamperedSig = WebhookService.computeSignature(secret, timestamp, payload + ' ');
    expect(tamperedSig).not.toBe(signature);
  });

  it('should execute MCP tools properly for autonomous agents', async () => {
    const usageResult = await McpServer.executeTool('user_student_demo', 'get_usage', {});
    expect(usageResult.error).toBeUndefined();
    expect(usageResult.result).toBeDefined();

    const practiceResult = await McpServer.executeTool('user_student_demo', 'start_practice', {
      scenario_id: 'scen_stud_qa',
    });
    expect(practiceResult.error).toBeUndefined();
    expect(practiceResult.result).toBeDefined();
  });

  it('should publish a valid and complete OpenAPI 3.1 specification', () => {
    expect(OPENAPI_SPEC.openapi).toBe('3.1.0');
    expect(OPENAPI_SPEC.info.title).toContain('StashMind');

    const paths = Object.keys(OPENAPI_SPEC.paths);
    expect(paths).toContain('/lessons');
    expect(paths).toContain('/lessons/{id}');
    expect(paths).toContain('/cards');
    expect(paths).toContain('/practice');
    expect(paths).toContain('/reviews/due');
    expect(paths).toContain('/usage');
    expect(paths).toContain('/export/deck/{id}');
  });
});
