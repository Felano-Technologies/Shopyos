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

  const fetchChats = async () => {
    try {
      // Check if user is authenticated before fetching
      const token = await storage.getItem('userToken');
      if (!token) {
        // User not authenticated, skip fetching
        return;
      }

      const response = await getConversations();
      if (response && response.conversations) {
        // Transform API data to Context shape
        const formatted: Conversation[] = response.conversations.map((c: any) => ({
          id: c.id,
          name: c.otherParticipant?.user_profiles?.full_name || 'Unknown User',
          avatar: c.otherParticipant?.user_profiles?.avatar_url || 'https://via.placeholder.com/150',
          lastMessage: c.lastMessage?.content || 'No messages yet',
          time: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unread: c.unreadCount || 0,
          online: false, // Backend doesn't support online status yet
          messages: [], // We fetch messages on demand usually, or we could pre-fetch last one
          otherParticipant: c.otherParticipant
        }));

        // TODO: Properly separate buyer vs seller chats if the backend supports that distinction
        // For now, we populate 'sellerConversations' effectively, as we are prioritizing BF.
        // If we want to use this for both, we might need a way to know "who started it" or context.
        setSellerChats(formatted);
        // setBuyerChats(formatted); 
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
    <ChatContext.Provider value={{ buyerConversations, sellerConversations, sendMessage, markAsRead }}>
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