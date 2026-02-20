// context/ChatContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getConversations, sendMessage as apiSendMessage, markConversationRead, storage } from '../../services/api';
import { useFocusEffect } from 'expo-router';

export type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
};

export type Conversation = {
  id: string;
  name: string; // Changed 'user' to 'name' to be generic (Store Name or Customer Name)
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages: Message[];
  otherParticipant?: any; // To store raw participant data
};

type ChatContextType = {
  buyerConversations: Conversation[];  // Chats where I am the customer
  sellerConversations: Conversation[]; // Chats where I am the business
  sendMessage: (id: string, text: string, type: 'buyer' | 'seller') => void;
  markAsRead: (id: string, type: 'buyer' | 'seller') => void;
  refresh: () => void;
  currentUserId: string | null;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// --- Real Data State ---
// We will fetch these from the backend
// For now, the backend returns a flat list of conversations.
// We might need to differentiate based on the context (if the user is acting as a buyer or seller).
// But for simplicity, we'll store all fetched conversations.



export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [buyerConversations, setBuyerChats] = useState<Conversation[]>([]);
  const [sellerConversations, setSellerChats] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchChats = async () => {
    try {
      // Check if user is authenticated before fetching
      const token = await storage.getItem('userToken');
      if (!token) {
        // User not authenticated, skip fetching
        return;
      }

      let activeUserId = await storage.getItem('userId');

      if (activeUserId) {
        setCurrentUserId(activeUserId);
      } else {
        // Fallback: fetch from API
        try {
          const { api } = require('../../services/api');
          const meResponse = await api.get('/auth/me');
          if (meResponse.data?.id) {
            activeUserId = meResponse.data.id;
            await storage.setItem('userId', activeUserId!);
            setCurrentUserId(activeUserId);
          }
        } catch (e) {
          console.warn('Failed to fetch userId for chat:', e);
        }
      }

      const response = await getConversations();
      if (response && response.conversations) {
        // Transform API data to Context shape
        const formatted: Conversation[] = response.conversations.map((c: any) => {
          const p = c.otherParticipant;

          // Determine name and avatar (prioritize store if available)
          let name = 'Unknown User';
          let avatar = 'https://via.placeholder.com/150';

          if (p) {
            // Check for store details first
            if (p.store) {
              name = p.store.store_name || name;
              avatar = p.store.logo_url || avatar;
            } else {
              // Fallback to user profile
              // Handle if user_profiles is array or object
              const profile = Array.isArray(p.user_profiles) ? p.user_profiles[0] : p.user_profiles;
              if (profile) {
                name = profile.full_name || name;
                avatar = profile.avatar_url || avatar;
              }
            }
          }

          // Determine last message sender
          const lastMsgSenderId = c.lastMessage?.sender_id;
          const isMe = activeUserId && lastMsgSenderId === activeUserId;
          const time = c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          // Construct messages with last message
          const messages = c.lastMessage ? [{
            id: c.lastMessage.id,
            text: c.lastMessage.content,
            sender: isMe ? 'me' : 'them',
            time: time // reusing time string
          }] : [];

          return {
            id: c.id,
            name,
            avatar,
            lastMessage: c.lastMessage?.content || 'No messages yet',
            time,
            unread: c.unreadCount || 0,
            online: false,
            messages, // Use constructed array
            otherParticipant: p
          };
        });

        // Populate both buyer and seller conversations
        // until backend supports distinguishing them
        setBuyerChats(formatted);
        setSellerChats(formatted);
      }
    } catch (error: any) {
      // Only log error if it's not a 401 (unauthorized)
      if (error.response?.status !== 401) {
        console.error('Failed to load chats', error);
      }
    }
  };

  useEffect(() => {
    fetchChats();
    // Optional: Poll every 30s
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (id: string, text: string, type: 'buyer' | 'seller') => {
    // Optimistic update
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage: Message = { id: Date.now().toString(), text, sender: 'me', time };

    // Update local state immediately
    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;
    updater(prev => prev.map(conv => {
      if (conv.id === id) {
        return {
          ...conv,
          lastMessage: text,
          time,
          messages: [...(conv.messages || []), newMessage]
        };
      }
      return conv;
    }));

    // Call API
    try {
      await apiSendMessage(id, text);
      // Refresh to confirm and get real ID/timestamp
      fetchChats();
    } catch (error) {
      console.error("Failed to send message", error);
      // revert optimistic update if needed
    }
  };

  const markAsRead = async (id: string, type: 'buyer' | 'seller') => {
    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;
    updater(prev => prev.map(conv => conv.id === id ? { ...conv, unread: 0 } : conv));

    try {
      await markConversationRead(id);
      fetchChats();
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  return (
    <ChatContext.Provider value={{
      buyerConversations,
      sellerConversations,
      sendMessage,
      markAsRead,
      refresh: fetchChats,
      currentUserId
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};

// Dummy default export to prevent Expo Router warning
// This file should not be accessed as a route
export default function NotARoute() {
  return null;
}