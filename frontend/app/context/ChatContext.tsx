// context/ChatContext.tsx
import React, { createContext, useContext, useState } from 'react';

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
};

type ChatContextType = {
  buyerConversations: Conversation[];  // Chats where I am the customer
  sellerConversations: Conversation[]; // Chats where I am the business
  sendMessage: (id: string, text: string, type: 'buyer' | 'seller') => void;
  markAsRead: (id: string, type: 'buyer' | 'seller') => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// --- Mock Data: Buyer Mode (Me talking to Stores) ---
const INITIAL_BUYER_CHATS: Conversation[] = [
  {
    id: 'b1',
    name: 'Urban Trends Store',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    lastMessage: 'Your order is on the way!',
    time: '10:30 AM',
    unread: 1,
    online: true,
    messages: [{ id: 'm1', text: 'Your order is on the way!', sender: 'them', time: '10:30 AM' }]
  },
];

// --- Mock Data: Seller Mode (Customers talking to Me) ---
const INITIAL_SELLER_CHATS: Conversation[] = [
  {
    id: 's1',
    name: 'David Lartey (Customer)',
    avatar: 'https://randomuser.me/api/portraits/men/86.jpg',
    lastMessage: 'Is this still available?',
    time: 'Yesterday',
    unread: 2,
    online: true,
    messages: [{ id: 'm1', text: 'Is this still available?', sender: 'them', time: 'Yesterday' }]
  },
];

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [buyerConversations, setBuyerChats] = useState(INITIAL_BUYER_CHATS);
  const [sellerConversations, setSellerChats] = useState(INITIAL_SELLER_CHATS);

  const sendMessage = (id: string, text: string, type: 'buyer' | 'seller') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage: Message = { id: Date.now().toString(), text, sender: 'me', time };

    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;

    updater(prev => prev.map(conv => {
      if (conv.id === id) {
        return {
          ...conv,
          lastMessage: text,
          time: 'Just now',
          messages: [...conv.messages, newMessage]
        };
      }
      return conv;
    }));
  };

  const markAsRead = (id: string, type: 'buyer' | 'seller') => {
    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;
    updater(prev => prev.map(conv => conv.id === id ? { ...conv, unread: 0 } : conv));
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