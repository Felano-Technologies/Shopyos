import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { createSnap, uploadSnapImage } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';

export default function CreateSnapScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadToBackend = async (uri: string) => {
    const res = await uploadSnapImage(uri);
    // Use public_url for the full accessible URL
    return res.data.public_url || res.data.url;
  };

  const handlePost = async () => {
    if (!imageUri) {
      Alert.alert('Missing Image', 'Please select an image for your snap.');
      return;
    }

    setLoading(true);
    try {
      const publicUrl = await uploadToBackend(imageUri);
      await createSnap(publicUrl, caption);
      
      CustomInAppToast.show({ type: 'success', title: 'Snap Posted', message: 'Your snap is now live for 24 hours!' });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post snap.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Snap</Text>
        <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={loading || !imageUri}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.postBtnTxt}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={48} color="#94A3B8" />
              <Text style={styles.placeholderTxt}>Tap to add photo (9:16)</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Caption (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Write something catchy..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={100}
            value={caption}
            onChangeText={setCaption}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  postBtn: {
    backgroundColor: '#84cc16',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnTxt: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
  content: { padding: 20 },
  imagePicker: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderTxt: { marginTop: 12, fontSize: 15, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#334155', marginBottom: 8 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
  }
});
