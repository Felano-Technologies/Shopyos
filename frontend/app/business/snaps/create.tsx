import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import AppImage from '@/components/AppImage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createSnap, uploadSnapImage } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { requestCameraPermissionWithDisclosure, requestMediaLibraryPermissionWithDisclosure } from '@/src/utils/permissions';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export default function CreateSnapScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [contentTerms, setContentTerms] = useState<Disclaimer | null>(null);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  React.useEffect(() => {
    getDisclaimerByType('content_terms').then(setContentTerms).catch(() => null);
  }, []);
  const pickImage = async () => {
    Alert.alert(
      'Add Photo or Video',
      'How would you like to add a photo or video?',
      [
        {
          text: 'Take Photo/Video',
          onPress: async () => {
            const { status } = await requestCameraPermissionWithDisclosure();
            if (status !== 'granted') {
              CustomInAppToast.show({ type: 'error', title: 'Permission Required', message: 'Camera access is needed to take photos or videos.' });
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              allowsEditing: true,
              aspect: [9, 16],
              quality: 0.8,
              videoMaxDuration: 60,
            });
            if (!result.canceled) {
              handlePickedAsset(result.assets[0]);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await requestMediaLibraryPermissionWithDisclosure();
            if (status !== 'granted') {
              CustomInAppToast.show({ type: 'error', title: 'Permission Required', message: 'Gallery access is needed to select photos or videos.' });
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              allowsEditing: true,
              aspect: [9, 16],
              quality: 0.8,
              videoMaxDuration: 60,
              videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
            });
            if (!result.canceled) {
              handlePickedAsset(result.assets[0]);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handlePickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    // 1. Check duration limit for videos (60 seconds)
    const isVid = asset.type === 'video' ||
                  asset.uri.toLowerCase().endsWith('.mp4') ||
                  asset.uri.toLowerCase().endsWith('.mov') ||
                  asset.uri.toLowerCase().endsWith('.webm') ||
                  asset.uri.toLowerCase().endsWith('.quicktime');

    if (isVid && asset.duration) {
      const duration = asset.duration;
      // Handle both seconds (e.g. 7) and milliseconds (e.g. 7000)
      const durationInSeconds = duration > 300 ? duration / 1000 : duration;
      if (durationInSeconds > 60) {
        CustomInAppToast.show({ type: 'error', title: 'Video Too Long', message: 'Snap videos are limited to a maximum length of 1 minute (60 seconds).' });
        return;
      }
    }

    // 2. Check file size limit (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (asset.fileSize && asset.fileSize > maxSize) {
      CustomInAppToast.show({ type: 'error', title: 'File Too Large', message: 'Selected photo or video exceeds the 100MB size limit. Please choose a smaller file.' });
      return;
    }

    setImageUri(asset.uri);
  };

  const isVideo = imageUri?.toLowerCase().endsWith('.mp4') ||
                  imageUri?.toLowerCase().endsWith('.mov') ||
                  imageUri?.toLowerCase().endsWith('.quicktime') ||
                  imageUri?.toLowerCase().endsWith('.webm');

  const uploadToBackend = async (uri: string) => {
    const res = await uploadSnapImage(uri, (percent) => setUploadProgress(Math.round(percent * 0.9)));
    return res.data.url;
  };

  const handlePost = async () => {
    if (!imageUri) {
      CustomInAppToast.show({ type: 'error', title: 'Missing Media', message: 'Please select a photo or video for your snap.' });
      return;
    }
    if (contentTerms && !isTermsChecked) {
      CustomInAppToast.show({ type: 'info', title: 'Agreement Required', message: 'Please agree to the Content Policy before posting your snap.' });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      const publicUrl = await uploadToBackend(imageUri);
      setUploadProgress(95);
      await createSnap(publicUrl, caption);
      setUploadProgress(100);
      CustomInAppToast.show({ type: 'success', title: 'Snap Posted', message: 'Your snap is now live for 24 hours!' });
      router.back();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Could not post snap.' });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <SafeAreaView edges={['top']} style={{ width: '100%' }}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Snap</Text>
            <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={loading || !imageUri}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.postBtnTxt}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={[styles.imagePicker, imageUri ? styles.imagePickerSelected : null]}
          onPress={pickImage}
          activeOpacity={0.8}
        >
          {imageUri ? (
            isVideo ? (
              <Video
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
              />
            ) : (
              <AppImage uri={imageUri} style={styles.previewImage} />
            )
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={40} color={colors.accent} />
              <Text style={styles.placeholderTxt}>Tap to add photo or video{"\n"}(9:16 aspect ratio)</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Caption (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Write something catchy..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={100}
            value={caption}
            onChangeText={setCaption}
          />
        </View>

        {contentTerms && (
          <View style={styles.disclaimerRow}>
            <TouchableOpacity style={styles.disclaimerCheckbox} activeOpacity={0.8} onPress={async () => {
              if (isTermsChecked) { setIsTermsChecked(false); return; }
              try { await acknowledgeDisclaimer('content_terms', contentTerms.version); setIsTermsChecked(true); }
              catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not record your agreement. Please try again.' }); }
            }}>
              <View style={[styles.disclaimerBox, isTermsChecked && styles.disclaimerBoxChecked]}>
                {isTermsChecked && <Ionicons name="checkmark" size={13} color="#FFF" />}
              </View>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>
              I own this content and agree to the{' '}
              <Text style={styles.disclaimerLink} onPress={() => setShowTermsModal(true)}>
                Content Policy
              </Text>
            </Text>
          </View>
        )}
        <DisclaimerModal
          type="content_terms"
          visible={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          onAcknowledge={() => { setIsTermsChecked(true); setShowTermsModal(false); }}
        />
      </ScrollView>

      {loading && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressContainer}>
            <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 16 }} />
            <Text style={styles.progressText}>
              {uploadProgress === 100
                ? 'Saving snap...'
                : uploadProgress >= 60
                  ? `Optimising video... ${uploadProgress}%`
                  : uploadProgress > 0
                    ? `Uploading... ${uploadProgress}%`
                    : 'Preparing upload...'}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.backgroundAlt },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  postBtn: {
    backgroundColor: c.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnTxt: { color: c.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 14 },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  imagePicker: {
    height: 220,
    aspectRatio: 9 / 16,
    backgroundColor: c.border,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: c.borderStrong,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  imagePickerSelected: {
    borderWidth: 0,
    shadowOpacity: 0.1,
  },
  previewImage: { width: '100%', height: '100%' },
  placeholder: { justifyContent: 'center', alignItems: 'center', padding: 16 },
  placeholderTxt: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: c.text, marginBottom: 8 },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 12,
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: c.text,
  },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16, paddingHorizontal: 4 },
  disclaimerCheckbox: { padding: 4 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: c.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  disclaimerBoxChecked: { backgroundColor: c.primary },
  disclaimerText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: c.textSecondary, lineHeight: 18 },
  disclaimerLink: { color: c.primary, fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  progressContainer: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 30,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  progressText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: c.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: c.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: c.accent,
    borderRadius: 3,
  }
});
