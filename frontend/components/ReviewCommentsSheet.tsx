import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
    id: string;
    user: { full_name: string; avatar_url: string };
    text: string;
    created_at: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    reviewId: string | null;
    comments: Comment[];
    onSendComment: (text: string) => void;
    isSubmitting: boolean;
}

export const ReviewCommentsSheet = ({ visible, onClose, comments, onSendComment, isSubmitting }: Props) => {
    const [newComment, setNewComment] = useState('');

    const handleSend = () => {
        if (newComment.trim().length === 0) return;
        onSendComment(newComment);
        setNewComment('');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
                
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={styles.sheetContent}
                >
                    <View style={styles.header}>
                        <View style={styles.dragHandle} />
                        <View style={styles.headerRow}>
                            <Text style={styles.title}>Replies ({comments.length})</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <FlatList
                        data={comments}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listPadding}
                        renderItem={({ item }) => (
                            <View style={styles.commentItem}>
                                <Image source={{ uri: item.user.avatar_url }} style={styles.commentAvatar} />
                                <View style={styles.commentBody}>
                                    <View style={styles.commentHeader}>
                                        <Text style={styles.commentUser}>{item.user.full_name}</Text>
                                        <Text style={styles.commentDate}>{formatDistanceToNow(new Date(item.created_at))} ago</Text>
                                    </View>
                                    <Text style={styles.commentText}>{item.text}</Text>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Feather name="message-square" size={40} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No replies yet. Start the conversation!</Text>
                            </View>
                        }
                    />

                    {/* Input Area */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Write a reply..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            value={newComment}
                            onChangeText={setNewComment}
                        />
                        <TouchableOpacity 
                            style={[styles.sendBtn, !newComment.trim() && styles.sendBtnDisabled]} 
                            onPress={handleSend}
                            disabled={!newComment.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Ionicons name="send" size={18} color="#FFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    backdrop: { flex: 1 },
    sheetContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '70%' },
    header: { paddingVertical: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 15 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20 },
    title: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    closeBtn: { padding: 4 },
    listPadding: { padding: 20, paddingBottom: 40 },
    commentItem: { flexDirection: 'row', marginBottom: 20 },
    commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9' },
    commentBody: { flex: 1, marginLeft: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 16 },
    commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    commentUser: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#334155' },
    commentDate: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
    commentText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#475569', lineHeight: 18 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF' },
    input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, fontFamily: 'Montserrat-Medium', fontSize: 14 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sendBtnDisabled: { backgroundColor: '#94A3B8' },
    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, fontSize: 14, color: '#94A3B8', fontFamily: 'Montserrat-Medium', textAlign: 'center' }
});