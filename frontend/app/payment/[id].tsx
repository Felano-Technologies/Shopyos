import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { initializePayment, verifyPayment } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemeStore } from '@/store/themeStore';
import { ThemeColors } from '@/constants/Colors';

type LegacyPalette = {
  bg: string;
  navy: string;
  card: string;
  muted: string;
  subtle: string;
  border: string;
  lime: string;
  textInverse: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.backgroundAlt,
    navy: colors.primary,
    card: colors.surface,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    border: colors.border,
    lime: colors.accent,
    textInverse: colors.textInverse,
  };
}

const { width } = Dimensions.get('window');

type PaymentStatus = 'initializing' | 'waiting' | 'verifying' | 'success' | 'failed';

export default function PaymentProcessingScreen() {
    const { id, method } = useLocalSearchParams<{ id: string; method: string }>();
    const router = useRouter();
    const themeColors = useThemeColors();
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
    const C = useMemo(() => buildC(themeColors), [themeColors]);
    const styles = useMemo(() => getStyles(C), [C]);
    const [status, setStatus] = useState<PaymentStatus>('initializing');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [progress] = useState(new Animated.Value(0));
    const [paymentRef, setPaymentRef] = useState<string | null>(null);
    const appState = useRef(AppState.currentState);
    const verifyAttempts = useRef(0);
    const mountedRef = useRef(true);
    const verifyInFlight = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

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
            let channel: string | undefined;
            if (method === 'momo') {
              channel = 'mobile_money';
            } else if (method === 'card') {
              channel = 'card';
            }

            // Generate deep link redirect URL
            const callbackUrl = Linking.createURL(`/payment/${id}`);

            const initRes = await initializePayment({
                orderId: id,
                channel: channel as any,
                callbackUrl,
            });


            if (initRes.success && initRes.data) {
                const { authorization_url, reference } = initRes.data;
                
                if (!authorization_url) {
                    console.error('No authorization URL in response:', initRes.data);
                    setErrorMessage('Payment provider did not return a valid payment URL');
                    setStatus('failed');
                    return;
                }

                setPaymentRef(reference);
                setStatus('waiting');


                // Open Paystack checkout in auth session
                // For MoMo: Paystack will show the MoMo prompt (USSD/STK push)
                // For Card: Paystack will show the card form
                const result = await WebBrowser.openAuthSessionAsync(authorization_url, callbackUrl);


                // When browser closes/redirects, verify
                if (result.type === 'success' || result.type === 'cancel' || result.type === 'dismiss') {
                    handleVerify(reference);
                }
            } else {
                console.error('Payment initialization failed:', initRes.error);
                setErrorMessage(initRes.error || 'Failed to initialize payment');
                setStatus('failed');
            }
        } catch (e: any) {
            console.error("Payment Init Error:", e);
            setErrorMessage(e.message || 'An unexpected error occurred');
            setStatus('failed');
        }
    }, [id, method, startAnimation]);

    const handleVerify = async (ref: string) => {
        // A retry loop may already be running (e.g. re-foregrounding the app) —
        // never start a second concurrent verification for the same payment.
        if (verifyInFlight.current) return;
        verifyInFlight.current = true;
        try {
            if (!mountedRef.current) return;
            setStatus('verifying');
            verifyAttempts.current = 0;
            const maxAttempts = 6;

            const check = async (): Promise<void> => {
                if (!mountedRef.current) return;
                const res = await verifyPayment(ref);
                if (!mountedRef.current) return;

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
                console.error('Max verification attempts reached');
                setErrorMessage(res.error || 'Could not confirm payment. If you were charged, it will be reconciled automatically.');
                setStatus('failed');
            };

            await check();
        } catch (e: any) {
            console.error("Verification Error:", e);
            if (mountedRef.current) {
                setErrorMessage(e.message || 'Verification failed');
                setStatus('failed');
            }
        } finally {
            verifyInFlight.current = false;
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

    let statusView: React.JSX.Element;
    if (status === 'success') {
        statusView = (
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
        );
    } else if (status === 'failed') {
        statusView = (
            <View style={styles.center}>
                <View style={[styles.successCircle, { backgroundColor: '#EF4444' }]}>
                    <Ionicons name="close" size={60} color="#FFF" />
                </View>
                <Text style={styles.title}>Payment Failed</Text>
                <Text style={styles.subtitle}>
                    {errorMessage || "We couldn't verify your payment. If you were debited, please contact support."}
                </Text>
                <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: C.navy, marginBottom: 12 }]}
                    onPress={() => handleInitialize()}
                >
                    <Text style={styles.doneBtnText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: C.muted }]}
                    onPress={() => router.back()}
                >
                    <Text style={styles.doneBtnText}>Return to Cart</Text>
                </TouchableOpacity>
            </View>
        );
    } else {
        statusView = (
            <View style={styles.center}>
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons
                        name={getIcon()}
                        size={50}
                        color={C.navy}
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
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />

            <View style={styles.card}>
                {statusView}
            </View>
        </View>
    );
}

const getStyles = (C: LegacyPalette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
    card: { width: width * 0.85, backgroundColor: C.card, borderRadius: 30, padding: 30, shadowColor: C.navy, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    center: { alignItems: 'center' },
    iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    statusText: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.navy, textAlign: 'center', marginBottom: 30 },
    progressBarBg: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
    progressBarFill: { height: '100%', backgroundColor: C.navy },
    info: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.subtle, textAlign: 'center' },

    successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    title: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: 10 },
    subtitle: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    doneBtn: { backgroundColor: C.lime, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 20, width: '100%', alignItems: 'center' },
    doneBtnText: { color: C.textInverse, fontSize: 16, fontFamily: 'Montserrat-Bold' },
    retryBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: C.border, borderRadius: 10, marginBottom: 20 },
    retryText: { color: C.navy, fontSize: 13, fontFamily: 'Montserrat-Bold' }
});
