// services/uploadUtils.ts
// React Native's legacy FormData shorthand — appending a plain
// `{ uri, name, type }` object as a "file" — stopped working once the New
// Architecture's stricter FormData/Networking implementation shipped
// (throws "Unsupported FormDataPart implementation"). The fix is to append a
// real Blob instead, which is also the spec-correct way to do it.
async function readBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  let blob = await readBlob(uri);
  // fetch(file://...).blob() occasionally resolves with a 0-byte body on RN
  // (the native file read hasn't actually landed yet) — this silently
  // produces an empty upload with no error anywhere in the chain, so retry
  // once before giving up rather than letting it through.
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
