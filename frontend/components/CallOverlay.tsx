import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
interface CallOverlayProps {
  isVisible: boolean;
  status: 'incoming' | 'outgoing' | 'connected' | 'ended';
  name: string;
  avatar: string;
  isMuted: boolean;
  isSpeakerOn: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}
export const CallOverlay: React.FC<CallOverlayProps> = ({
  isVisible,
  status,
  name,
  avatar,
  isMuted,
  isSpeakerOn,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
}) => {
  const [timer, setTimer] = useState(0);
  useEffect(() => {
    let interval: any;
    if (status === 'connected') {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [status]);
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  if (!isVisible) return null;
  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={styles.container}>
        <Image
          source={{ uri: avatar || 'https://via.placeholder.com/150' }}
          style={StyleSheet.absoluteFill}
          blurRadius={50}
        />
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{ uri: avatar || 'https://via.placeholder.com/150' }}
                  style={styles.avatar}
                />
                {status === 'connected' && (
                  <View style={styles.pulseContainer}>
                    <View style={styles.pulse} />
                  </View>
                )}
              </View>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.statusText}>
                {status === 'incoming'
                  ? 'Incoming Voice Call'
                  : status === 'outgoing'
                  ? 'Ringing...'
                  : status === 'connected'
                  ? formatTimer(timer)
                  : 'Call Ended'}
              </Text>
            </View>
            <View style={styles.footer}>
              {status === 'incoming' ? (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.circleButton, styles.rejectButton]}
                    onPress={onReject}
                  >
                    <Ionicons name="close" size={32} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.circleButton, styles.acceptButton]}
                    onPress={onAccept}
                  >
                    <Ionicons name="call" size={32} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  {status === 'connected' && (
                    <TouchableOpacity style={styles.squareButton} onPress={onToggleMute}>
                      <Ionicons 
                        name={isMuted ? "mic-off" : "mic"} 
                        size={24} 
                        color={isMuted ? "#ef4444" : "white"} 
                      />
                      <Text style={[styles.buttonLabel, isMuted && { color: '#ef4444' }]}>
                        {isMuted ? "Unmute" : "Mute"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.circleButton, styles.endButton]}
                    onPress={onEnd}
                  >
                    <MaterialCommunityIcons name="phone-hangup" size={32} color="white" />
                  </TouchableOpacity>
                  {status === 'connected' && (
                    <TouchableOpacity style={styles.squareButton} onPress={onToggleSpeaker}>
                      <Ionicons 
                        name={isSpeakerOn ? "volume-high" : "volume-medium"} 
                        size={24} 
                        color={isSpeakerOn ? "#22c55e" : "white"} 
                      />
                      <Text style={[styles.buttonLabel, isSpeakerOn && { color: '#22c55e' }]}>
                        Speaker
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  header: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pulseContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  pulse: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  name: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Medium',
    color: 'rgba(255,255,255,0.6)',
  },
  footer: {
    width: '100%',
    paddingHorizontal: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  circleButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  endButton: {
    backgroundColor: '#ef4444',
  },
  squareButton: {
    alignItems: 'center',
    gap: 8,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
  },
});