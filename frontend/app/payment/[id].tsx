import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Dimensions, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { initializePayment, verifyPayment, getUserData } from '@/services/api';

const { width } = Dimensions.get('window');

export default function PaymentProcessingScreen() {
    const { id, method } = useLocalSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'initializing' | 'waiting' | 'verifying' | 'success' | 'failed'>('initializing');
    const [progress] = useState(new Animated.Value(0));
    const [paymentRef, setPaymentRef] = useState<string | null>(null);
    const appState = useRef(AppState.currentState);

    const startAnimation = () => {
        progress.setValue(0);
        Animated.loop(
            Animated.timing(progress, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: false,
            })
        ).start();
    };

    const handleInitialize = async () => {
        try {
            setStatus('initializing');
            startAnimation();

            // 1. Get user email (usually should be in a context)
            const userRes = await getUserData();
            if (!userRes?.user?.email) throw new Error("User email not found");

            // 2. Initialize with backend (use a fixed amount or fetch from order)
            // For now, we'll assume the backend can fetch order total if we send it
            // but let's send a dummy amount if we don't have it, or fetch it first.
            // Better: Backend should handle amount fetching from orderId.
            // I'll update the backend controller to fetch amount if not provided.
            const initRes = await initializePayment(id as string, userRes.user.email, 1.0); // Amount will be overridden by backend or handled there

            if (initRes.success) {
                setPaymentRef(initRes.data.reference);
                setStatus('waiting');

                // 3. Open Paystack
                const result = await WebBrowser.openBrowserAsync(initRes.data.authorization_url);

                // 4. When browser closes, check status
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    handleVerify(initRes.data.reference);
                }
            } else {
                setStatus('failed');
            }
        } catch (e) {
            console.error("Payment Init Error:", e);
            setStatus('failed');
        }
    };

    const handleVerify = async (ref: string) => {
        try {
            setStatus('verifying');
            let attempts = 0;
            const maxAttempts = 5;

            const check = async () => {
                const res = await verifyPayment(ref);
                if (res.success) {
                    setStatus('success');
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, 3000); // Wait 3s and try again
                } else {
                    setStatus('failed');
                }
            };

            await check();
        } catch (e) {
            console.error("Verification Error:", e);
            setStatus('failed');
        }
    };

    // Listen for AppState changes (if user returns to app)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (status === 'waiting' && paymentRef) {
                    handleVerify(paymentRef);
                }
            }
            appState.current = nextAppState;
        });

        handleInitialize();

        return () => {
            subscription.remove();
        };
    }, []);

    const getProcessingText = () => {
        if (status === 'initializing') return "Initializing secure payment...";
        if (status === 'waiting') return "Please complete payment in the browser";
        if (status === 'verifying') return "Verifying transaction with Paystack...";
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
                        <Text style={styles.title}>Payment Success!</Text>
                        <Text style={styles.subtitle}>Your transaction was successful. We are now processing your order.</Text>

                        <TouchableOpacity
                            style={styles.doneBtn}
                            onPress={() => router.replace(`/order/${id}` as any)}
                        >
                            <Text style={styles.doneBtnText}>Track My Order</Text>
                        </TouchableOpacity>
                    </View>
                ) : status === 'failed' ? (
                    <View style={styles.center}>
                        <View style={[styles.successCircle, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="close" size={60} color="#FFF" />
                        </View>
                        <Text style={styles.title}>Payment Failed</Text>
                        <Text style={styles.subtitle}>We couldn't verify your payment. If you were debited, please contact support.</Text>

                        <TouchableOpacity
                            style={[styles.doneBtn, { backgroundColor: '#0C1559' }]}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.doneBtnText}>Return to Cart</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.center}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons
                                name={"credit-card-outline"}
                                size={50}
                                color="#0C1559"
                            />
                        </View>
                        <Text style={styles.statusText}>{getProcessingText()}</Text>

                        <View style={styles.progressBarBg}>
                            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
                        </View>

                        {(status === 'waiting' || status === 'verifying') && (
                            <TouchableOpacity style={styles.retryBtn} onPress={() => paymentRef && handleVerify(paymentRef)}>
                                <Text style={styles.retryText}>I've finished paying</Text>
                            </TouchableOpacity>
                        )}

                        <Text style={styles.info}>Secure transaction powered by Paystack</Text>
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
    doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
    retryBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#F1F5F9', borderRadius: 10, marginBottom: 20 },
    retryText: { color: '#0C1559', fontSize: 13, fontFamily: 'Montserrat-Bold' }
});
