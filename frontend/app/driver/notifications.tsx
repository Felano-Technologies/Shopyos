// app/driver/notifications.tsx
import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useNotifications';
import { getRouteFromNotification } from '@/utils/notificationRouting';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemeStore } from '@/store/themeStore';
import { ThemeColors } from '@/constants/Colors';
const { width } = Dimensions.get('window');
type Notification = {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    is_read: boolean;
    created_at: string;
};
export default function DriverNotificationsScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
    const styles = useMemo(() => getStyles(colors), [colors]);
    const { data, refetch, isRefetching } = useNotifications();
    const markReadMutation = useMarkNotificationRead();
    const notifications = data?.notifications || [];
    const onRefresh = () => {
        refetch();
    };
    const handleNotificationPress = async (notification: Notification) => {
        if (!notification.is_read) {
            try {
                await markReadMutation.mutateAsync(notification.id);
            } catch (error) {
                console.error("Failed to mark notification as read", error);
            }
        }
        const route = getRouteFromNotification(notification, 'driver');
        if (route) router.push(route as any);
    };
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'new_delivery_available':
            case 'delivery_assigned':
                return { name: 'notifications-active', color: colors.accent };
            case 'delivery_update':
            case 'delivery_in_transit':
            case 'delivery_picked_up':
                return { name: 'local-shipping', color: colors.info };
            case 'delivery_completed':
            case 'order_delivered':
                return { name: 'check-circle', color: colors.success };
            case 'delivery_cancelled':
            case 'delivery_issue':
                return { name: 'cancel', color: colors.error };
            case 'new_message':
            case 'message_received':
                return { name: 'chat-bubble', color: colors.primary };
            case 'payment_received':
                return { name: 'payments', color: colors.success };
            case 'driver_verification':
                return { name: 'verified-user', color: colors.warning };
            default:
                return { name: 'notifications', color: colors.textSecondary };
        }
    };
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };
    const renderNotification = ({ item }: { item: Notification }) => {
        const icon = getNotificationIcon(item.type);
        return (
            <TouchableOpacity
                style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
                    <MaterialIcons name={icon.name as any} size={24} color={icon.color} />
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title} numberOfLines={1}>
                            {item.title}
                        </Text>
                        {!item.is_read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.message} numberOfLines={2}>
                        {item.message}
                    </Text>
                    <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
        );
    };
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <MaterialIcons name="notifications-none" size={80} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications Yet</Text>
            <Text style={styles.emptySubtitle}>
                You&apos;ll receive updates about new deliveries, messages, and earnings here.
            </Text>
            <TouchableOpacity
                style={styles.goOnlineButton}
                onPress={() => router.push('/driver/dashboard')}
            >
                <LinearGradient
                    colors={[colors.accent, colors.accent]} // single-tone; no darker-accent token exists for a true gradient
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.buttonText}>Go to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.accentText} />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
    return (
        <View style={styles.container}>
            <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
            {/* Header */}
            <SafeAreaView edges={['top']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={styles.placeholder} />
            </SafeAreaView>
            {/* Notifications List */}
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotification}
                contentContainerStyle={[
                    styles.listContent,
                    notifications.length === 0 && styles.emptyListContent
                ]}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={onRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
const getStyles = (c: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: c.surfaceElevated
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.border
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.surfaceElevated,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat-Bold',
        color: c.text
    },
    placeholder: {
        width: 40
    },
    // List
    listContent: {
        padding: 20
    },
    emptyListContent: {
        flexGrow: 1
    },
    // Notification Card
    notificationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: c.border,
        shadowColor: '#000', // neutral shadow, low-impact decorative in both themes
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
    },
    unreadCard: {
        borderColor: c.accent,
        borderWidth: 1.5,
        backgroundColor: `${c.accent}1A` // subtle accent-tinted highlight, adapts per theme
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    contentContainer: {
        flex: 1,
        marginRight: 8
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    title: {
        fontSize: 15,
        fontFamily: 'Montserrat-Bold',
        color: c.text,
        flex: 1
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: c.accent,
        marginLeft: 8
    },
    message: {
        fontSize: 13,
        fontFamily: 'Montserrat-Regular',
        color: c.textSecondary,
        lineHeight: 18,
        marginBottom: 6
    },
    time: {
        fontSize: 11,
        fontFamily: 'Montserrat-Medium',
        color: c.textMuted
    },
    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: c.surfaceElevated,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Montserrat-Bold',
        color: c.text,
        marginBottom: 8,
        textAlign: 'center'
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: 'Montserrat-Regular',
        color: c.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32
    },
    goOnlineButton: {
        width: width - 80,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: c.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5
    },
    gradientButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 8
    },
    buttonText: {
        color: c.accentText, // pairs with the fixed accent-colored button background
        fontSize: 16,
        fontFamily: 'Montserrat-Bold'
    }
});