import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { verifyPayment } from '@/services/api';

const { width, height } = Dimensions.get('window');

export default function PaymentProcessingScreen() {
    const { id, method } = useLocalSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'processing' | 'verifying' | 'success' | 'failed'>('processing');
    const [progress] = useState(new Animated.Value(0));

    useEffect(() => {
        // Phase 1: Simulated Gateway Processing (3 seconds)
        Animated.timing(progress, {
            toValue: 1,
            duration: 3500,
            useNativeDriver: false,
        }).start();

        const timer = setTimeout(() => {
            setStatus('verifying');
            handleVerify();
        }, 4000);

        return () => clearTimeout(timer);
    }, []);

    const handleVerify = async () => {
        try {
            const res = await verifyPayment(id as string);
            if (res.success) {
                setStatus('success');
            } else {
                setStatus('failed');
            }
        } catch (e) {
            console.error(e);
            setStatus('failed');
        }
    };

    const getProcessingText = () => {
        if (status === 'processing') return `Connecting to ${method === 'momo' ? 'Momo Provider' : 'Bank Gateway'}...`;
        if (status === 'verifying') return "Confirming transaction status...";
        if (status === 'success') return "Payment Confirmed!";
        return "Transaction Failed";
    };

    const progressWidth = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            <View style={styles.card}>
                {status === 'success' ? (
                    <View style={styles.center}>
                        <View style={styles.successCircle}>
                            <Ionicons name="checkmark" size={60} color="#FFF" />
                        </View>
                        <Text style={styles.title}>Woohoo!</Text>
                        <Text style={styles.subtitle}>Your payment was successful and your order is being prepared.</Text>

                        <TouchableOpacity
                            style={styles.doneBtn}
                            onPress={() => router.replace(`/order/${id}` as any)}
                        >
                            <Text style={styles.doneBtnText}>Track Order</Text>
                        </TouchableOpacity>
                    </View>
                ) : status === 'failed' ? (
                    <View style={styles.center}>
                        <View style={[styles.successCircle, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="close" size={60} color="#FFF" />
                        </View>
                        <Text style={styles.title}>Oops!</Text>
                        <Text style={styles.subtitle}>Something went wrong with your transaction. Please try again.</Text>

                        <TouchableOpacity
                            style={[styles.doneBtn, { backgroundColor: '#0C1559' }]}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.doneBtnText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.center}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons
                                name={method === 'momo' ? "cellphone-nfc" : "credit-card-outline"}
                                size={50}
                                color="#0C1559"
                            />
                        </View>
                        <Text style={styles.statusText}>{getProcessingText()}</Text>

                        <View style={styles.progressBarBg}>
                            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
                        </View>

                        <Text style={styles.info}>Please do not close the app or refresh the page.</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    card: { width: width * 0.85, backgroundColor: '#FFF', borderRadius: 30, padding: 30, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    center: { alignItems: 'center' },
    iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    statusText: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559', textAlign: 'center', marginBottom: 30 },
    progressBarBg: { width: '100%', height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
    progressBarFill: { height: '100%', backgroundColor: '#0C1559' },
    info: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8', textAlign: 'center' },

    successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#84cc16', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    title: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 10 },
    subtitle: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    doneBtn: { backgroundColor: '#84cc16', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 20, width: '100%', alignItems: 'center' },
    doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' }
});
