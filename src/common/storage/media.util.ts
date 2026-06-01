// Helpers for persisting and describing inbound message media (voice notes,
// images, documents). Media bytes live in StorageService under the `media/`
// prefix; the message row only keeps a lightweight reference in `metadata`.

// Reference persisted in Message.metadata.media. `key` is the StorageService
// key (without the storage's own `media/` prefix) used to stream the bytes.
export interface StoredMedia {
  key: string;
  mimetype: string;
  filename?: string;
}

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
};

// Derive a file extension, preferring the original filename's extension and
// falling back to a mimetype lookup, then `bin`.
const mediaExtension = (mimetype: string | undefined, filename?: string): string => {
  const fromName = filename?.includes('.') ? filename.split('.').pop() : undefined;
  if (fromName) return fromName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = (mimetype ?? '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSIONS[base] ?? 'bin';
};

// Build a filesystem/S3-safe storage key, e.g. `<sessionId>/<messageId>.<ext>`.
export const buildMediaKey = (
  sessionId: string,
  messageId: string,
  mimetype: string | undefined,
  filename?: string,
): string => {
  const safeSession = sessionId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeId = messageId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safeSession}/${safeId}.${mediaExtension(mimetype, filename)}`;
};
