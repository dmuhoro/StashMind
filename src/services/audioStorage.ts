/**
 * Audio Storage Service — AppWrite Storage for audio files.
 *
 * Stores generated audio in the private `audio` bucket. Only pointers
 * (fileId, bucketId) are stored in database rows; audio bytes live in
 * Storage to respect Appwrite row size limits.
 */

import { getAdminStorage, ID } from './appwriteClient.ts';

export interface AudioUploadResult {
  fileId: string;
  bucketId: string;
  size: number;
}

export interface AudioStreamResult {
  fileId: string;
  bucketId: string;
  size: number;
  mimeType: string;
}

/**
 * Uploads audio to Appwrite Storage (private `audio` bucket).
 * Returns the file ID and bucket ID for storage in the lesson row.
 */
export async function uploadAudio(
  audioBuffer: Buffer | Uint8Array,
  fileName: string
): Promise<AudioUploadResult> {
  const storage = getAdminStorage();
  const bucketId = process.env.APPWRITE_BUCKET_AUDIO || 'audio';

  const file = await storage.createFile(
    bucketId,
    ID.unique(),
    audioBuffer as unknown as File
  );

  return {
    fileId: file.$id,
    bucketId: file.bucketId,
    size: file.sizeOriginal,
  };
}

/**
 * Deletes audio from Appwrite Storage when a lesson is deleted.
 */
export async function deleteAudio(fileId: string): Promise<void> {
  const storage = getAdminStorage();
  const bucketId = process.env.APPWRITE_BUCKET_AUDIO || 'audio';
  try {
    await storage.deleteFile(bucketId, fileId);
  } catch {
    // File may already be deleted — ignore
  }
}

/**
 * Gets a download URL for an audio file with optional expiration.
 * AppWrite generates time-limited URLs for private bucket access.
 */
export async function getAudioUrl(fileId: string, expirySeconds: number = 3600): Promise<string> {
  const storage = getAdminStorage();
  const bucketId = process.env.APPWRITE_BUCKET_AUDIO || 'audio';

  const url = storage.getFileView(bucketId, fileId);
  return String(url);
}

/**
 * Downloads audio file bytes from AppWrite Storage.
 */
export async function downloadAudio(fileId: string): Promise<Buffer> {
  const storage = getAdminStorage();
  const bucketId = process.env.APPWRITE_BUCKET_AUDIO || 'audio';

  const file = await storage.getFileDownload(bucketId, fileId);
  const chunks: Buffer[] = [];
  for await (const chunk of file as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Converts WAV audio to Opus for data-saver mode (low-bitrate).
 * If ffmpeg is not available, returns the original WAV buffer.
 */
export async function convertToOpus(
  wavBuffer: Buffer,
  bitrateKbps: number = 32
): Promise<{ buffer: Buffer; mimeType: string; bitrateKbps: number }> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    // Check if ffmpeg is available
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });

    const inputFile = '/tmp/stashmind_input.wav';
    const outputFile = '/tmp/stashmind_output.opus';

    // Write WAV to temp file
    const { writeFile } = await import('fs/promises');
    await writeFile(inputFile, wavBuffer);

    // Convert to Opus at target bitrate
    await execFileAsync(
      'ffmpeg',
      ['-i', inputFile, '-c:a', 'libopus', '-b:a', `${bitrateKbps}k`, '-y', outputFile],
      { timeout: 30000 }
    );

    const { readFile } = await import('fs/promises');
    const opusBuffer = (await readFile(outputFile)) as unknown as Buffer;

    return {
      buffer: opusBuffer,
      mimeType: 'audio/opus',
      bitrateKbps,
    };
  } catch {
    // ffmpeg not available or conversion failed — return original WAV
    return {
      buffer: wavBuffer,
      mimeType: 'audio/wav',
      bitrateKbps: 0,
    };
  }
}

/**
 * Measures audio duration using ffprobe, or estimates from word count.
 */
export async function measureAudioDuration(
  audioBuffer: Buffer
): Promise<number> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    await execFileAsync('ffprobe', ['-version'], { timeout: 5000 });

    const { writeFile } = await import('fs/promises');
    const inputFile = '/tmp/stashmind_probe.wav';
    await writeFile(inputFile, audioBuffer);

    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1', inputFile],
      { timeout: 10000 }
    );

    return parseFloat(stdout.trim()) || 0;
  } catch {
    // ffprobe not available — estimate from word count (~140 words/minute)
    // This is a fallback; the buffer may not be text so return a safe default
    return 60;
  }
}
