import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getNotifications } from '@/services/api';

const NotificationScreen = () => {
    const navigation = useNavigation();
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await getNotifications();
                if (res && res.notifications) {
                    setNotifications(res.notifications);
                }
            } catch (error) {
                console.error("Failed to load notifications", error);
            }
        };
        fetchNotifications();
    }, []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <Text style={styles.header}>Notifications</Text>

            {/* Show Empty State if No Notifications */}
            {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>Nothing to see yet</Text>
                    <Text style={styles.emptySubtitle}>
                        You’ll get updates on your account and shopping activity here.
                    </Text>
                    <TouchableOpacity
                        style={styles.startShoppingButton}
                        onPress={() => router.push('/')}
                    >
                        <Text style={styles.buttonText}>Start shopping</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <View style={styles.notificationItem}>
                            <Text style={styles.notificationText}>{item.message}</Text>
                        </View>
                    )}
                />
            )}
            <View style={styles.bottomNav}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navButton}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
            </View>
        </View>

    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        paddingTop: 50, // Adjust for status bar
        paddingHorizontal: 20,
    },
    header: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: 'gray',
        textAlign: 'center',
        paddingHorizontal: 30,
        marginBottom: 20,
    },
    startShoppingButton: {
        backgroundColor: '#069E2D', // pigment green color from the image
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    notificationItem: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginVertical: 5,
    },
    notificationText: {
        fontSize: 14,
    },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'flex-start', // Moves content to the left
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 0,
        borderColor: '#ddd',
        backgroundColor: 'white',
        position: 'relative',
        bottom: 50,
        left: 0,
        right: 0,

    },
    navButton: {
        alignSelf: 'flex-start',
        padding: 10,
        backgroundColor: 'white',
        borderRadius: 20,
        elevation: 3,
    },
});

export default NotificationScreen;
