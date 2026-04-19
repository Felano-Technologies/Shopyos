// app/driver/notifications.tsx
import React from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';

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
    const { data, isLoading, refetch, isRefetching } = useNotifications();
    const markReadMutation = useMarkNotificationRead();
    const notifications = data?.notifications || [];

    const onRefresh = () => {
        refetch();
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            try {
                await markReadMutation.mutateAsync(notification.id);
            } catch (error) {
                console.error("Failed to mark notification as read", error);
            }
        }

        // Navigate based on notification type
        if (notification.data?.deliveryId) {
            router.push({
                pathname: '/driver/activeOrder',
                params: { deliveryId: notification.data.deliveryId }
            });
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'new_delivery_available':
                return { name: 'notifications-active', color: '#84cc16' };
            case 'delivery_cancelled':
                return { name: 'cancel', color: '#EF4444' };
            case 'message_received':
                return { name: 'chat-bubble', color: '#3B82F6' };
            case 'payment_received':
                return { name: 'payments', color: '#10B981' };
            default:
                return { name: 'notifications', color: '#64748B' };
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

                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <MaterialIcons name="notifications-none" size={80} color="#CBD5E1" />
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
                    colors={['#84cc16', '#65a30d']}
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.buttonText}>Go to Dashboard</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <SafeAreaView edges={['top']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
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
                        tintColor="#84cc16"
                        colors={['#84cc16']}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat-Bold',
        color: '#0F172A'
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
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
    },
    unreadCard: {
        borderColor: '#84cc16',
        borderWidth: 1.5,
        backgroundColor: '#F7FEE7'
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
        color: '#0F172A',
        flex: 1
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#84cc16',
        marginLeft: 8
    },
    message: {
        fontSize: 13,
        fontFamily: 'Montserrat-Regular',
        color: '#64748B',
        lineHeight: 18,
        marginBottom: 6
    },
    time: {
        fontSize: 11,
        fontFamily: 'Montserrat-Medium',
        color: '#94A3B8'
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
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Montserrat-Bold',
        color: '#0F172A',
        marginBottom: 8,
        textAlign: 'center'
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: 'Montserrat-Regular',
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32
    },
    goOnlineButton: {
        width: width - 80,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#84cc16',
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
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Montserrat-Bold'
    }
});
