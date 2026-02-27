import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Dimensions, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { initializePayment, verifyPayment } from '@/services/api';

const { width } = Dimensions.get('window');

type PaymentStatus = 'initializing' | 'waiting' | 'verifying' | 'success' | 'failed';

export default function PaymentProcessingScreen() {
    const { id, method } = useLocalSearchParams<{ id: string; method: string }>();
    const router = useRouter();
    const [status, setStatus] = useState<PaymentStatus>('initializing');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [progress] = useState(new Animated.Value(0));
    const [paymentRef, setPaymentRef] = useState<string | null>(null);
    const appState = useRef(AppState.currentState);
    const verifyAttempts = useRef(0);

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
            setErrorMessage('');
            startAnimation();

            // Determine channel from method param
            const channel = method === 'momo' ? 'mobile_money' : method === 'card' ? 'card' : undefined;

            const initRes = await initializePayment({
                orderId: id,
                channel: channel as any,
            });

            if (initRes.success && initRes.data) {
                setPaymentRef(initRes.data.reference);
                setStatus('waiting');

                // Open Paystack checkout in browser
                // For MoMo: Paystack will show the MoMo prompt (USSD/STK push)
                // For Card: Paystack will show the card form
                const result = await WebBrowser.openBrowserAsync(initRes.data.authorization_url);

                // When browser closes, verify
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    handleVerify(initRes.data.reference);
                }
            } else {
                setErrorMessage(initRes.error || 'Failed to initialize payment');
                setStatus('failed');
            }
        } catch (e: any) {
            console.error("Payment Init Error:", e);
            setErrorMessage(e.message || 'An unexpected error occurred');
            setStatus('failed');
        }
    };

    const handleVerify = async (ref: string) => {
        try {
            setStatus('verifying');
            verifyAttempts.current = 0;
            const maxAttempts = 6;

            const check = async (): Promise<void> => {
                const res = await verifyPayment(ref);

                if (res.success) {
                    setStatus('success');
                    return;
                }

                // Check if it's a pending MoMo transaction (user hasn't confirmed yet)
                const txnStatus = res.data?.status;
                if (txnStatus === 'pending' || txnStatus === 'send_otp' || txnStatus === 'ongoing') {
                    // Still processing, retry
                    if (verifyAttempts.current < maxAttempts) {
                        verifyAttempts.current++;
                        await new Promise(r => setTimeout(r, 4000)); // MoMo takes longer
                        return check();
                    }
                }

                if (verifyAttempts.current < maxAttempts) {
                    verifyAttempts.current++;
                    await new Promise(r => setTimeout(r, 3000));
                    return check();
                }

                // Max attempts reached
                setErrorMessage(res.error || 'Could not confirm payment. If you were charged, it will be reconciled automatically.');
                setStatus('failed');
            };

            await check();
        } catch (e: any) {
            console.error("Verification Error:", e);
            setErrorMessage(e.message || 'Verification failed');
            setStatus('failed');
        }
    };

    // Listen for app returning to foreground (user completed MoMo USSD/STK push)
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
        switch (status) {
            case 'initializing': return 'Initializing secure payment...';
            case 'waiting':
                return method === 'momo'
                    ? 'Please approve the payment on your phone'
                    : 'Please complete payment in the browser';
            case 'verifying': return 'Verifying transaction with Paystack...';
            case 'success': return 'Payment Confirmed!';
            case 'failed': return 'Transaction Failed';
        }
    };

    const getIcon = () => {
        if (method === 'momo') return 'cellphone-nfc';
        return 'credit-card-outline';
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
                        <Text style={styles.subtitle}>
                            {errorMessage || "We couldn't verify your payment. If you were debited, please contact support."}
                        </Text>

                        <TouchableOpacity
                            style={[styles.doneBtn, { backgroundColor: '#0C1559', marginBottom: 12 }]}
                            onPress={() => handleInitialize()}
                        >
                            <Text style={styles.doneBtnText}>Try Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.doneBtn, { backgroundColor: '#64748B' }]}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.doneBtnText}>Return to Cart</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.center}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons
                                name={getIcon()}
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
