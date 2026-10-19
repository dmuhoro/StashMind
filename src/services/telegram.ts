/**
 * Telegram Bot Service: Ingestion webhook for StashMind
 *
 * Users forward links, PDFs, or text to the bot and receive a dual-host audio lesson back.
 * Fits how people already share study material on low-bandwidth mobile connections.
 *
 * Telegram Bot API: https://core.telegram.org/bots/api
 */

import { IngestionService } from './ingestion.ts';
import { LessonEngine } from './lessonEngine.ts';
import { TtsEngine } from './ttsEngine.ts';
import { StashMindRepository } from '../db/repository.ts';
import { AUDIENCE_PRESETS, TTS_PROVIDER_DUAL_HOST, type AudiencePreset } from '../config/index.ts';

const TELEGRAM_API = 'https://api.telegram.org';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

interface TelegramMessage {
  message_id: number;
  from: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string };
  text?: string;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  voice?: { file_id: string; duration: number; mime_type?: string };
  caption?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/**
 * Sends a text message via Telegram sendMessage.
 */
async function sendMessage(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch {
    // Best-effort; do not fail the webhook
  }
}

/**
 * Sends an audio file via Telegram sendAudio.
 */
async function sendAudio(chatId: number, audioBase64: string, title: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendAudio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        audio: `data:audio/wav;base64,${audioBase64}`,
        title,
        caption: 'Your StashMind dual-host audio lesson',
      }),
    });
  } catch {
    // Best-effort
  }
}

/**
 * Processes an incoming Telegram message: ingest content, generate lesson, synthesize audio,
 * save to repository, and send the audio back to the user.
 */
export async function processTelegramMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const userId = `tg_${message.from.id}`;

  // Extract text content from message
  let sourceText = '';
  let sourceTitle = 'Telegram Lesson';
  let sourceType: 'text' | 'url' | 'youtube' = 'text';

  if (message.text) {
    sourceText = message.text;
    sourceTitle = message.text.slice(0, 60);
  } else if (message.caption) {
    sourceText = message.caption;
    sourceTitle = message.caption.slice(0, 60);
  }

  if (!sourceText || sourceText.length < 50) {
    await sendMessage(chatId, 'Please send a link, PDF, or text (minimum 50 characters) to generate a lesson.');
    return;
  }

  // Detect if the text is a URL
  try {
    const parsed = new URL(sourceText);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      if (parsed.hostname.includes('youtube.com') || parsed.hostname === 'youtu.be') {
        sourceType = 'youtube';
      } else {
        sourceType = 'url';
      }
    }
  } catch {
    // Not a URL, treat as plain text
  }

  try {
    // Ingest
    let ingested;
    if (sourceType === 'url') {
      ingested = await IngestionService.ingestArticleUrl(sourceText);
    } else if (sourceType === 'youtube') {
      ingested = await IngestionService.ingestYouTubeUrl(sourceText);
    } else {
      ingested = IngestionService.ingestPastedText(sourceText, sourceTitle);
    }

    // Generate lesson
    const { lesson, cards } = await LessonEngine.generateLesson({
      userId,
      sourceText: ingested.text,
      sourceTitle: ingested.title,
      audiencePreset: AUDIENCE_PRESETS.STUDENT,
      style: 'tldr',
      durationMinutes: 10,
    });

    // Synthesize audio
    const audioResult = await TtsEngine.synthesizeLessonAudio(lesson.script);

    // Save to repository
    await StashMindRepository.instance.saveLesson(userId, lesson);
    await StashMindRepository.instance.saveCards(userId, cards);

    // Send audio back to user
    if (audioResult.base64Wav) {
      await sendAudio(chatId, audioResult.base64Wav, lesson.title);
    }

    // Send summary
    const cardCount = cards.length;
    await sendMessage(
      chatId,
      `📚 *${lesson.title}*\n${lesson.summary}\n\n${cardCount} insight cards generated. Use /study to review.`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await sendMessage(chatId, `❌ Could not generate lesson: ${message}`);
  }
}

/**
 * Handles an incoming Telegram webhook update.
 */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<{ ok: boolean }> {
  if (!BOT_TOKEN) {
    return { ok: false };
  }

  if (update.message) {
    await processTelegramMessage(update.message);
  }

  return { ok: true };
}

/**
 * Sets the Telegram webhook URL (call once after deployment).
 */
export async function setWebhook(webhookUrl: string): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json();
    return { ok: data.ok, result: data.result };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Gets bot info to verify the token is valid.
 */
export async function getMe(): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/getMe`);
    const data = await res.json();
    return { ok: data.ok, result: data.result };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
