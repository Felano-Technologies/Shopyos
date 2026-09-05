// services/uploadUtils.ts
// React Native's legacy FormData shorthand — appending a plain
// `{ uri, name, type }` object as a "file" — stopped working once the New
// Architecture's stricter FormData/Networking implementation shipped
// (throws "Unsupported FormDataPart implementation"). The fix is to append a
// real Blob instead, which is also the spec-correct way to do it.
export async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  const response = await fetch(uri);
  const blob = await response.blob();
  // Local file:// URIs sometimes come back with an empty/generic blob.type
  // from RN's fetch implementation — force the known MIME type when we have one.
  if (mimeType && blob.type !== mimeType) {
    return new Blob([blob], { type: mimeType });
  }
  return blob;
}
