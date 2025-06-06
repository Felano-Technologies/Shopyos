// app/settings/contactUs.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';

export default function ContactUsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';

  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }
    // TODO: Send this message to your support backend
    Alert.alert('Sent', 'Your message has been sent to support.');
    setMessage('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.title, { color: primaryText }]}>Contact Us</Text>
        <TextInput
          style={[styles.textArea, { color: primaryText, borderColor: secondaryText }]}
          placeholder="Type your message here..."
          placeholderTextColor={secondaryText}
          multiline
          numberOfLines={6}
          value={message}
          onChangeText={setMessage}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDark ? '#4F46E5' : '#222222' }]}
          onPress={handleSend}
        >
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  textArea: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
});
