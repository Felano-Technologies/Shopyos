import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { 
    View, 
    Text, 
    StyleSheet, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator, 
    Modal, 
    Dimensions,
    Animated 
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useMyBusinesses } from '@/hooks/useBusiness';
import { Audio } from 'expo-av'; // --- NEW IMPORT ---

const { width } = Dimensions.get('window');

export default function VerificationStatus() {
    const { data: businessesData, refetch, isLoading } = useMyBusinesses();
    const business = businessesData?.businesses?.[0];

    const [checking, setChecking] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [scaleAnim] = useState(new Animated.Value(0));
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    // --- NEW: SOUND & HAPTIC LOGIC ---
    async function playSuccessSound() {
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/notification.wav')
            );
            setSound(sound);
            await sound.playAsync();
        } catch (error) {
            console.warn('Playback error:', error);
        }
    }

    // Cleanup sound when component unmounts
    useEffect(() => {
        return sound ? () => { sound.unloadAsync(); } : undefined;
    }, [sound]);

    const handleCheckStatus = async () => {
        setChecking(true);
        setShowStatusModal(true);
        
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7
        }).start();

        const result = await refetch();
        
        setTimeout(async () => {
            setChecking(false);
            // If the status is now verified, play the sound!
            if (result.data?.businesses?.[0]?.verificationStatus === 'verified') {
                await playSuccessSound();
            }
        }, 1500);
    };

    if (isLoading && !showStatusModal) return <ActivityIndicator style={{ flex: 1 }} color="#0C1559" />;
    if (!business) return null;

    const isPending = business.verificationStatus === 'pending';
    const isRejected = business.verificationStatus === 'rejected';
    const isVerified = business.verificationStatus === 'verified';

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="dark" />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top', 'left', 'right']}>
                <ScrollView contentContainerStyle={styles.lockoutScroll} showsVerticalScrollIndicator={false}>
                    
                    <View style={[styles.iconCircle, isRejected && styles.iconCircleRejected]}>
                        <Ionicons
                            name={isPending ? 'time-outline' : isRejected ? 'close-circle-outline' : 'checkmark-circle-outline'}
                            size={52}
                            color={isPending ? '#D97706' : isRejected ? '#DC2626' : '#16A34A'}
                        />
                    </View>

                    <Text style={styles.title}>
                        {isPending ? 'Awaiting Approval' : isRejected ? 'Verification Rejected' : 'Verified!'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isPending
                            ? 'Your business is currently under review. You can access the full platform once an admin approves your store.'
                            : isRejected 
                            ? 'Your business verification was rejected. Please review the reason below and resubmit your details.'
                            : 'Congratulations! Your business has been approved by our administrators.'}
                    </Text>

                    <View style={[styles.statusBadge, isRejected && styles.badgeRejected, isVerified && styles.badgeVerified]}>
                        <Ionicons 
                            name={isPending ? 'hourglass-outline' : isRejected ? 'alert-circle-outline' : 'checkmark-circle'} 
                            size={14} 
                            color={isPending ? '#92400E' : isRejected ? '#991B1B' : '#15803D'} 
                        />
                        <Text style={[styles.badgeText, isRejected && { color: '#991B1B' }, isVerified && { color: '#15803D' }]}>
                            {isPending ? 'Status: Under Review' : isRejected ? 'Status: Rejected' : 'Status: Verified'}
                        </Text>
                    </View>

                    {isRejected && business.rejectionReason && (
                        <View style={styles.reasonCard}>
                            <Text style={styles.reasonLabel}>Rejection Reason</Text>
                            <Text style={styles.reasonText}>{business.rejectionReason}</Text>
                        </View>
                    )}

                    <View style={styles.stepsContainer}>
                        {(isPending || isVerified
                            ? ['Submit your business details', 'Admin reviews your application', 'Get approved & go live']
                            : ['Review the rejection reason above', 'Update your business information', 'Resubmit for admin review']
                        ).map((step, i) => (
                            <View key={i} style={styles.stepRow}>
                                <View style={[styles.stepNum, (i === 0 || (isVerified && i <= 2)) && styles.stepNumActive]}>
                                    {isVerified && i < 3 ? (
                                         <Ionicons name="checkmark" size={14} color="#FFF" />
                                    ) : (
                                        <Text style={styles.stepNumText}>{i + 1}</Text>
                                    )}
                                </View>
                                <Text style={[styles.stepText, isVerified && { color: '#0C1559', fontFamily: 'Montserrat-SemiBold' }]}>{step}</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.btn}
                        onPress={() => router.push(`/business/verification?businessId=${business._id}` as any)}
                    >
                        <LinearGradient colors={['#0C1559', '#1e40af']} style={styles.btnGradient}>
                            <Ionicons name={isPending ? 'document-text-outline' : 'refresh-outline'} size={18} color="#FFF" />
                            <Text style={styles.btnText}>{isPending ? 'Update Application' : 'Resubmit Details'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCheckStatus} style={{ marginTop: 20, padding: 10 }}>
                        <Text style={styles.refreshText}>Tap to check status</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

            <Modal visible={showStatusModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
                        {checking ? (
                            <View style={styles.modalBody}>
                                <ActivityIndicator size="large" color="#0C1559" />
                                <Text style={styles.modalInfoTitle}>Synchronizing...</Text>
                                <Text style={styles.modalInfoSub}>Verifying your status with Shopyos servers.</Text>
                            </View>
                        ) : isVerified ? (
                            <View style={styles.modalBody}>
                                <View style={styles.confettiContainer}>
                                    <Ionicons name="sparkles" size={40} color="#FBBF24" style={styles.sparkle1} />
                                    <Ionicons name="sparkles" size={30} color="#84CC16" style={styles.sparkle2} />
                                    <View style={styles.successCircle}>
                                        <Ionicons name="checkmark-done" size={60} color="#FFF" />
                                    </View>
                                </View>
                                <Text style={[styles.modalInfoTitle, { color: '#16A34A' }]}>Congratulations!</Text>
                                <Text style={styles.modalInfoSub}>Your store is now active. You have full access to the dashboard.</Text>
                                
                                <TouchableOpacity 
                                    style={[styles.modalBtn, { backgroundColor: '#16A34A' }]}
                                    onPress={() => {
                                        setShowStatusModal(false);
                                        router.replace('/business/dashboard');
                                    }}
                                >
                                    <Text style={styles.modalBtnText}>Go to Dashboard</Text>
                                    <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.modalBody}>
                                <View style={styles.pendingCircle}>
                                    <Feather name="clock" size={50} color="#D97706" />
                                </View>
                                <Text style={styles.modalInfoTitle}>Still Under Review</Text>
                                <Text style={styles.modalInfoSub}>Our team is carefully vetting your documents. Hang tight!</Text>
                                <TouchableOpacity 
                                    style={styles.modalBtn}
                                    onPress={() => setShowStatusModal(false)}
                                >
                                    <Text style={styles.modalBtnText}>I will wait</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

// ... styles remain the same from the previous code block ...
const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    lockoutScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    iconCircleRejected: { backgroundColor: '#FEE2E2' },
    title: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10 },
    subtitle: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 25 },
    badgeRejected: { backgroundColor: '#FEE2E2' },
    badgeVerified: { backgroundColor: '#DCFCE7' },
    badgeText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#92400E' },
    reasonCard: { width: '100%', backgroundColor: '#FEF2F2', borderRadius: 14, borderLeftWidth: 4, borderLeftColor: '#EF4444', padding: 16, marginBottom: 25 },
    reasonLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#991B1B', textTransform: 'uppercase', marginBottom: 4 },
    reasonText: { fontSize: 14, color: '#7F1D1D', lineHeight: 20 },
    stepsContainer: { width: '100%', marginBottom: 30 },
    stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 12 },
    stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    stepNumActive: { backgroundColor: '#0C1559' },
    stepNumText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#475569' },
    stepText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155' },
    btn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
    btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    btnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
    refreshText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', fontSize: 14, textDecorationLine: 'underline' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 21, 89, 0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: width * 0.85, backgroundColor: '#FFF', borderRadius: 30, padding: 30, elevation: 10 },
    modalBody: { alignItems: 'center' },
    modalInfoTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginTop: 20 },
    modalInfoSub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 20, fontFamily: 'Montserrat-Medium' },
    modalBtn: { backgroundColor: '#0C1559', width: '100%', paddingVertical: 15, borderRadius: 15, marginTop: 25, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    modalBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 15 },
    
    pendingCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
    successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
    confettiContainer: { position: 'relative' },
    sparkle1: { position: 'absolute', top: -10, left: -20 },
    sparkle2: { position: 'absolute', bottom: 10, right: -25 },
});