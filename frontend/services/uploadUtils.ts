// services/uploadUtils.ts
// React Native's legacy FormData shorthand — appending a plain
// `{ uri, name, type }` object as a "file" — stopped working once the New
// Architecture's stricter FormData/Networking implementation shipped
// (throws "Unsupported FormDataPart implementation"). The fix is to append a
// real Blob instead, which is also the spec-correct way to do it.
//
// `fetch(uri).blob()` is the only reliable way to get a genuine RN-native
// Blob (backed by RN's own native blob store, which is what the
// FormData/multipart networking bridge actually recognizes) — an object
// that merely implements the `Blob` *interface* (e.g. expo-file-system's
// `File`, which has the right `.size`/`.type` but isn't really an instance
// of RN's Blob) silently serializes as empty content over multipart even
// though every JS-side size check on it looks correct. That was tried here
// and produced exactly that: a "successful" upload that was actually 0
// bytes on the wire. So the blob MUST come from fetch().blob().
//
// The separate empty-upload bug this chain also hit — a gallery pick
// pointing at an iCloud-optimized-storage photo that hadn't finished
// downloading, so the source file itself was genuinely incomplete — is
// fixed upstream in useImagePickerSheet.ts (forces base64 materialization,
// writes a guaranteed-complete local copy). By the time a uri reaches this
// function, it should already be reading a real, complete file.
async function readBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  let blob = await readBlob(uri);
  console.log(`[uriToBlob] fetch(uri).blob() size=${blob.size} type=${blob.type}`);
  if (blob.size === 0) {
    await new Promise((r) => setTimeout(r, 300));
    blob = await readBlob(uri);
    console.log(`[uriToBlob] retry size=${blob.size} type=${blob.type}`);
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
