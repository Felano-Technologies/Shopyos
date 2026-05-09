import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
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

    const startAnimation = useCallback(() => {
        progress.setValue(0);
        Animated.loop(
            Animated.timing(progress, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: false,
            })
        ).start();
    }, [progress]);

    const handleInitialize = useCallback(async () => {
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
                const { authorization_url, reference } = initRes.data;
                
                if (!authorization_url) {
                    console.error('❌ No authorization URL in response:', initRes.data);
                    setErrorMessage('Payment provider did not return a valid payment URL');
                    setStatus('failed');
                    return;
                }

                setPaymentRef(reference);
                setStatus('waiting');


                // Open Paystack checkout in browser
                // For MoMo: Paystack will show the MoMo prompt (USSD/STK push)
                // For Card: Paystack will show the card form
                const result = await WebBrowser.openBrowserAsync(authorization_url);


                // When browser closes, verify
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    handleVerify(reference);
                }
            } else {
                console.error('❌ Payment initialization failed:', initRes.error);
                setErrorMessage(initRes.error || 'Failed to initialize payment');
                setStatus('failed');
            }
        } catch (e: any) {
            console.error("❌ Payment Init Error:", e);
            setErrorMessage(e.message || 'An unexpected error occurred');
            setStatus('failed');
        }
    }, [id, method, startAnimation]);

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
                console.error('❌ Max verification attempts reached');
                setErrorMessage(res.error || 'Could not confirm payment. If you were charged, it will be reconciled automatically.');
                setStatus('failed');
            };

            await check();
        } catch (e: any) {
            console.error("❌ Verification Error:", e);
            setErrorMessage(e.message || 'Verification failed');
            setStatus('failed');
        }
    };

    // Initialize once on mount
    useEffect(() => {
        if (id) {
            handleInitialize();
        }
    }, [id, handleInitialize]);

    // Listen for app returning to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (status === 'waiting' && paymentRef) {
                    handleVerify(paymentRef);
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [paymentRef, status]);

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

    const methodLabel = method === 'momo' ? 'Mobile Money' : 'Card Payment';
    const stepText = status === 'initializing'
        ? 'Step 1 of 3'
        : status === 'waiting'
            ? 'Step 2 of 3'
            : status === 'verifying'
                ? 'Step 3 of 3'
                : 'Completed';

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <LinearGradient colors={['#0B122D', '#192E73']} style={styles.hero}>
                <View style={styles.heroTopRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.heroTitle}>Secure Checkout</Text>
                    <View style={styles.backBtnGhost} />
                </View>
                <View style={styles.heroMetaRow}>
                    <View style={styles.methodPill}>
                        <MaterialCommunityIcons name={method === 'momo' ? 'cellphone-nfc' : 'credit-card-check-outline'} size={16} color="#DBEAFE" />
                        <Text style={styles.methodPillText}>{methodLabel}</Text>
                    </View>
                    <Text style={styles.stepText}>{stepText}</Text>
                </View>
            </LinearGradient>

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
                        <View style={[styles.successCircle, styles.failCircle]}>
                            <Ionicons name="close" size={60} color="#FFF" />
                        </View>
                        <Text style={styles.title}>Payment Failed</Text>
                        <Text style={styles.subtitle}>
                            {errorMessage || "We couldn't verify your payment. If you were debited, please contact support."}
                        </Text>

                        <TouchableOpacity
                            style={[styles.doneBtn, styles.retryPrimary]}
                            onPress={() => handleInitialize()}
                        >
                            <Text style={styles.doneBtnText}>Try Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.doneBtn, styles.retrySecondary]}
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
                                <Text style={styles.retryText}>I&apos;ve finished paying</Text>
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
    container: { flex: 1, backgroundColor: '#EFF3FF' },
    hero: {
        paddingTop: 56,
        paddingBottom: 110,
        paddingHorizontal: 18,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    backBtnGhost: { width: 38, height: 38 },
    heroTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    heroMetaRow: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    methodPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
    methodPillText: { color: '#E5EDFF', fontSize: 12, fontFamily: 'Montserrat-SemiBold' },
    stepText: { color: '#C7D2FE', fontSize: 12, fontFamily: 'Montserrat-SemiBold' },
    card: {
        width: width - 28,
        alignSelf: 'center',
        marginTop: -82,
        backgroundColor: '#FFF',
        borderRadius: 30,
        padding: 24,
        borderWidth: 1,
        borderColor: '#DDE6FF',
        shadowColor: '#0C1559',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
    },
    center: { alignItems: 'center' },
    iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#DBE4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    statusText: { fontSize: 19, fontFamily: 'Montserrat-Bold', color: '#102A6B', textAlign: 'center', marginBottom: 30, lineHeight: 27 },
    progressBarBg: { width: '100%', height: 10, backgroundColor: '#E5EAF8', borderRadius: 999, overflow: 'hidden', marginBottom: 20 },
    progressBarFill: { height: '100%', backgroundColor: '#1D4ED8' },
    info: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center' },

    successCircle: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    failCircle: { backgroundColor: '#EF4444' },
    title: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#102A6B', marginBottom: 10 },
    subtitle: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
    doneBtn: { backgroundColor: '#22C55E', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
    doneBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
    retryBtn: { marginTop: 10, paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#EEF2FF', borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#D6E0FF' },
    retryText: { color: '#1E3A8A', fontSize: 13, fontFamily: 'Montserrat-Bold' },
    retryPrimary: { backgroundColor: '#1E3A8A', marginBottom: 12 },
    retrySecondary: { backgroundColor: '#64748B' },
});
