// services/uploadUtils.ts
//
// CONFIRMED (via production Railway logs) root cause of empty-file uploads
// in the verification flow: sending a file as a `Blob` appended to a
// `FormData` — via either `fetch(uri).blob()` or expo-file-system's `File`
// — reaches the server with the correct filename/mimetype but 0 actual
// bytes. RN's Blob/native-blob-store bridging isn't reliably attaching real
// content to the outgoing multipart body on this app's architecture (this
// is the same mechanism behind the "Add the `expo-blob` package..."
// warning). `uriToBlob`/FormData is kept below only because many other,
// unrelated upload flows in this codebase (business.ts, products.ts, etc.)
// already use it and haven't been reported broken — do not assume it's
// reliable for anything new.
//
// For verification uploads specifically, use `uploadMultipartViaNativeFile`
// instead: it builds the multipart body by hand from real native file
// reads (`File.arrayBuffer()`), writes it to a temp file, and sends it via
// expo-file-system's `File.upload()` in BINARY_CONTENT mode — i.e. the
// exact bytes on disk become the raw POST body, with the multipart
// boundary/Content-Type set manually. This goes through expo-file-system's
// native upload path end-to-end and never touches RN's Blob at all.
import { File, Paths, UploadType } from 'expo-file-system';

async function readBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  let blob = await readBlob(uri);
  if (blob.size === 0) {
    await new Promise((r) => setTimeout(r, 300));
    blob = await readBlob(uri);
  }
  if (blob.size === 0) {
    throw new Error('Could not read the selected file — it appears to be empty. Please try picking it again.');
  }
  // Local file:// URIs sometimes come back with an empty/generic blob.type
  // from RN's fetch implementation — force the known MIME type when we have one.
  if (mimeType && blob.type !== mimeType) {
    return new Blob([blob], { type: mimeType });
  }
  return blob;
}

export type MultipartFilePart = { fieldName: string; filename: string; mimeType: string; uri: string };

// Sends fields + one-or-more files as a real multipart/form-data request,
// but built and shipped entirely through expo-file-system's native file
// APIs instead of RN's Blob/FormData — see the file header for why.
export async function uploadMultipartViaNativeFile(
  url: string,
  fields: Record<string, string>,
  files: MultipartFilePart[],
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  const boundary = `ShopyosBoundary${Date.now()}${Math.round(Math.random() * 1e9)}`;
  const CRLF = '\r\n';
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(encoder.encode(`--${boundary}${CRLF}Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}${value}${CRLF}`));
  }

  for (const part of files) {
    const file = new File(part.uri);
    if (!file.exists || !file.size) {
      throw new Error(`Could not read the file for "${part.fieldName}" — it appears to be empty. Please try again.`);
    }
    chunks.push(encoder.encode(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${part.fieldName}"; filename="${part.filename}"${CRLF}Content-Type: ${part.mimeType}${CRLF}${CRLF}`
    ));
    chunks.push(new Uint8Array(await file.arrayBuffer()));
    chunks.push(encoder.encode(CRLF));
  }
  chunks.push(encoder.encode(`--${boundary}--${CRLF}`));

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  const tempFile = new File(Paths.cache, `multipart-${Date.now()}-${Math.round(Math.random() * 1e6)}.bin`);
  tempFile.create({ overwrite: true });
  tempFile.write(body);

  try {
    const result = await tempFile.upload(url, {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    });
    return { status: result.status, body: result.body };
  } finally {
    try { tempFile.delete(); } catch {}
  }
}
