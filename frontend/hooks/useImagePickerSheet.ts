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
import { CustomInAppToast } from '@/components/InAppToastHost';

type PickOptions = ImagePicker.ImagePickerOptions;

export function useImagePickerSheet() {
  const launch = async (
    useCamera: boolean,
    opts: PickOptions
  ): Promise<string | null> => {
    const pickerOpts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // default to images
      ...opts,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(pickerOpts)
      : await ImagePicker.launchImageLibraryAsync(pickerOpts);

    return result.canceled ? null : result.assets[0].uri;
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
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
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
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
