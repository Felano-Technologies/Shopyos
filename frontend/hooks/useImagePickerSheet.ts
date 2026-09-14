/**
 * useImagePickerSheet
 * -------------------
 * Presents a native Alert action-sheet that lets the user choose between
 * "Take Photo" (camera) and "Choose from Gallery" (library), then returns
 * the picked asset URI or null if the user cancelled.
 *
 * Usage:
 *   const pickImage = useImagePickerSheet();
 *   const uri = await pickImage({ aspect: [1, 1] });
 */

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { requestCameraPermissionWithDisclosure, requestMediaLibraryPermissionWithDisclosure } from '@/src/utils/permissions';

type PickOptions = ImagePicker.ImagePickerOptions;

export function useImagePickerSheet() {
  const launch = async (
    useCamera: boolean,
    opts: PickOptions
  ): Promise<string | null> => {
    const pickerOpts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // default to images
      base64: true,
      ...opts,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(pickerOpts)
      : await ImagePicker.launchImageLibraryAsync(pickerOpts);

    if (result.canceled) {
      console.log('[imagePicker] cancelled');
      return null;
    }
    const asset = result.assets[0];
    console.log(`[imagePicker] picked asset.uri=${asset.uri} fileSize=${asset.fileSize ?? 'unknown'} mimeType=${asset.mimeType ?? 'unknown'} base64Length=${asset.base64?.length ?? 0}`);

    // A gallery pick can point at an iCloud-optimized-storage photo that
    // hasn't actually been downloaded to the device yet — the returned
    // asset.uri looks valid but reading it comes back empty (this produced
    // a real empty verification-document upload in production). Asking the
    // picker for base64 forces iOS to fully materialize the image before
    // the picker promise resolves, so writing that base64 out to a fresh
    // local file guarantees a complete file, regardless of what asset.uri
    // itself would have read as. Falls back to the raw uri only if base64
    // wasn't returned (e.g. video, or picker option override).
    if (asset.base64) {
      try {
        // expo-image-picker's base64 output is always re-encoded as JPEG
        // regardless of the source format, so the file extension must be
        // .jpg here even if asset.mimeType reports the original format.
        const file = new File(Paths.cache, `picked-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
        file.create({ overwrite: true });
        file.write(asset.base64, { encoding: 'base64' });
        console.log(`[imagePicker] wrote base64 to ${file.uri} — exists=${file.exists} size=${file.size}`);
        if (!file.exists || !file.size) {
          console.log('[imagePicker] written file is empty/missing despite base64 write — falling back to asset.uri');
        } else {
          return file.uri;
        }
      } catch (err: any) {
        console.log(`[imagePicker] base64 write FAILED: ${err?.message || err}`);
      }
    } else {
      console.log('[imagePicker] no base64 returned by picker — using asset.uri directly');
    }
    return asset.uri;
  };

  return (opts: PickOptions = {}): Promise<string | null> =>
    new Promise((resolve) => {
      const allowsVideo = opts.mediaTypes === ImagePicker.MediaTypeOptions.Videos || 
                          opts.mediaTypes === ImagePicker.MediaTypeOptions.All;
      const title = allowsVideo ? 'Add Photo or Video' : 'Add Photo';
      const message = allowsVideo 
        ? 'How would you like to add a photo or video?' 
        : 'How would you like to add a photo?';

      Alert.alert(
        title,
        message,
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const { status } = await requestCameraPermissionWithDisclosure();
              if (status !== 'granted') {
                CustomInAppToast.show({ type: 'error', title: 'Permission Required', message: 'Camera access is needed to take a photo.' });
                resolve(null);
                return;
              }
              resolve(await launch(true, opts));
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const { status } = await requestMediaLibraryPermissionWithDisclosure();
              if (status !== 'granted') {
                CustomInAppToast.show({ type: 'error', title: 'Permission Required', message: 'Gallery access is needed to pick a photo.' });
                resolve(null);
                return;
              }
              resolve(await launch(false, opts));
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(null),
          },
        ]
      );
    });
}
