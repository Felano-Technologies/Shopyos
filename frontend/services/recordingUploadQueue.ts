// services/recordingUploadQueue.ts
// Makes the recording upload asynchronous and retryable:
//
//   Call ends → recording finalized → enqueue({callId, filePath})
//     → upload attempt
//         success → delete local file, remove queue entry
//         failure → keep local file + queue entry, retry later
//
// The queue survives app restarts (AsyncStorage-backed) so a call recorded
// right before the app is killed still uploads on next launch/foreground.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { uploadCallRecording } from './calls';

const QUEUE_KEY = 'CALL_RECORDING_UPLOAD_QUEUE';

type QueueEntry = { callId: string; filePath: string; attempts: number };

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(entries: QueueEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // best-effort — worst case a queued upload is retried again next drain
  }
}

export async function enqueueRecordingUpload(callId: string, filePath: string): Promise<void> {
  const queue = await readQueue();
  if (queue.some((e) => e.callId === callId)) return;
  queue.push({ callId, filePath, attempts: 0 });
  await writeQueue(queue);
}

let draining = false;

// Attempts every queued upload once; failures stay queued for the next drain.
// Safe to call repeatedly (app foreground, after a call ends, periodic check)
// — concurrent calls are serialized via the `draining` guard.
export async function drainRecordingUploadQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const queue = await readQueue();
    if (!queue.length) return;

    const remaining: QueueEntry[] = [];
    for (const entry of queue) {
      try {
        const info = await FileSystem.getInfoAsync(entry.filePath);
        if (!info.exists) continue; // file gone (already uploaded elsewhere, or cleaned up) — drop silently

        await uploadCallRecording(entry.callId, entry.filePath);
        await FileSystem.deleteAsync(entry.filePath, { idempotent: true });
      } catch (err) {
        console.warn(`[CallRecording] Upload retry failed for call ${entry.callId}:`, err);
        remaining.push({ ...entry, attempts: entry.attempts + 1 });
      }
    }
    await writeQueue(remaining);
  } finally {
    draining = false;
  }
}
