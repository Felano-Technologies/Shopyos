import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

interface ReviewCardProps {
    review: any;
    onLike?: (id: string) => void;
    onComment?: (id: string) => void;
}

export const ReviewCard = ({ review, onLike, onComment }: ReviewCardProps) => {
    const [liked, setLiked] = useState(!!review.isLiked);
    const [likeCount, setLikeCount] = useState(review.likes_count || 0);

    React.useEffect(() => {
        setLiked(!!review.isLiked);
        setLikeCount(review.likes_count || 0);
    }, [review.isLiked, review.likes_count]);

    const handleLike = () => {
        setLiked(!liked);
        setLikeCount((prev: number) => liked ? prev - 1 : prev + 1);
        if (onLike) onLike(review.id);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Image
                    source={{ uri: review.user?.avatar_url || `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(review.user?.full_name || 'User')}` }}
                    style={styles.avatar}
                />
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{review.user?.full_name}</Text>
                    <Text style={styles.date}>{formatDistanceToNow(new Date(review.created_at))} ago</Text>
                </View>
                <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.ratingText}>{review.rating}</Text>
                </View>
            </View>

            <Text style={styles.comment}>{review.review_text}</Text>

            {review.seller_response ? (
                <View style={styles.sellerReply}>
                    <View style={styles.sellerReplyHeader}>
                        <Ionicons name="storefront-outline" size={13} color="#0C1559" />
                        <Text style={styles.sellerReplyLabel}>Store replied</Text>
                    </View>
                    <Text style={styles.sellerReplyText}>{review.seller_response}</Text>
                </View>
            ) : null}

            <View style={styles.footer}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                    <Ionicons 
                        name={liked ? "heart" : "heart-outline"} 
                        size={18} 
                        color={liked ? "#EF4444" : "#64748B"} 
                    />
                    <Text style={[styles.actionText, liked && { color: "#EF4444" }]}>{likeCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => onComment?.(review.id)}>
                    <Feather name="message-circle" size={18} color="#64748B" />
                    <Text style={styles.actionText}>{review.comments_count || 0}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    avatar: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#F1F5F9' },
    userInfo: { flex: 1, marginLeft: 10 },
    userName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    date: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    ratingText: { marginLeft: 4, fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#C2410C' },
    comment: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155', lineHeight: 20 },
    footer: { flexDirection: 'row', marginTop: 15, gap: 20, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    sellerReply: { backgroundColor: '#F0F4FF', borderLeftWidth: 3, borderLeftColor: '#0C1559', borderRadius: 8, padding: 10, marginTop: 10 },
    sellerReplyHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    sellerReplyLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    sellerReplyText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#334155', lineHeight: 18 },
});