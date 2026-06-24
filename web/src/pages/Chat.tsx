import React, { useState, useEffect, useRef } from 'react';
import { getConversations, getMessages, sendMessage } from '../services/messaging';
import { socketService } from '../services/socket';

const getOtherParticipant = (conv: any, currentUserId: string | null) => {
  if (!conv) return null;
  if (conv.participant) return conv.participant;
  const p1 = conv.participant1;
  const p2 = conv.participant2;
  if (p1 && p1.id !== currentUserId) return p1;
  if (p2 && p2.id !== currentUserId) return p2;
  return null;
};

const getParticipantName = (participant: any) => {
  if (!participant) return 'Store Chat';
  if (participant.name) return participant.name;
  if (participant.stores?.[0]?.store_name) return participant.stores[0].store_name;
  if (participant.user_profiles?.[0]?.full_name) return participant.user_profiles[0].full_name;
  return 'Store Chat';
};

export const Chat: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load conversations and user ID on mount
  useEffect(() => {
    const init = async () => {
      try {
        const { storage } = await import('../services/storage');
        const uid = await storage.getItem('userId');
        setCurrentUserId(uid);
      } catch (err) {
        console.warn('Failed to load user ID:', err);
      }
      try {
        const res = await getConversations();
        setConversations(res.conversations || res.data || []);
      } catch (err) {
        console.warn('Failed to load conversations:', err);
      }
    };
    init();
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    const loadMessages = async () => {
      setLoadingMsg(true);
      try {
        const res = await getMessages(activeConvId);
        setMessages(res.messages || res.data || []);
      } catch (err) {
        console.warn('Failed to load messages:', err);
      } finally {
        setLoadingMsg(false);
      }
    };

    loadMessages();

    // Connect socket and listen for live messaging
    let socketRef: any = null;
    const connectSocket = async () => {
      try {
        const socket = await socketService.connect();
        socketRef = socket;
        await socketService.joinConversation(activeConvId);
        
        socket.on('message:new', (data: any) => {
          if (data.conversationId === activeConvId) {
            setMessages((prev) => [...prev, data.message]);
          }
        });
      } catch (err) {
        console.warn('Socket message join failed:', err);
      }
    };

    connectSocket();

    return () => {
      if (socketRef) {
        socketService.leaveConversation(activeConvId).catch(() => {});
        socketRef.off('message:new');
      }
    };
  }, [activeConvId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !inputMsg.trim()) return;

    const text = inputMsg;
    setInputMsg('');

    try {
      // Use socket connection to send message if connected, fallback to API
      if (socketService.isConnected()) {
        const msg = await socketService.sendMessage(activeConvId, text);
        setMessages((prev) => [...prev, msg]);
      } else {
        const res = await sendMessage(activeConvId, text);
        setMessages((prev) => [...prev, res.message || res.data]);
      }
    } catch (err) {
      console.warn('Failed to send message:', err);
    }
  };

  return (
    <div className="bg-white animate-fade-in grid grid-cols-1 md:grid-cols-[300px_1fr] h-[70vh] rounded-[24px] overflow-hidden border border-gray-100 shadow-sm mt-4">
      {/* Inbox List Side */}
      <div className="border-r border-gray-100 flex flex-col h-full bg-gray-50/50">
        <div className="p-4 border-b border-gray-100 font-bold text-base text-body">
          Inbox Chats
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-subtle text-center text-sm">No active conversations.</div>
          ) : (
            conversations.map((conv) => {
              const otherParticipant = getOtherParticipant(conv, currentUserId);
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`p-4 cursor-pointer border-b border-gray-100 transition-colors duration-150 ${
                    conv.id === activeConvId ? 'bg-navy/5 border-l-4 border-l-navy' : 'hover:bg-white border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="font-bold text-sm text-body mb-1">
                    {getParticipantName(otherParticipant)}
                  </div>
                  <div className="text-xs text-subtle truncate">
                    {conv.lastMessage?.content || 'Tap to chat...'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Messages Workspace Side */}
      <div className="flex flex-col h-full bg-white relative">
        {activeConvId ? (
          <>
            <div className="p-4 border-b border-gray-100 font-bold text-sm text-body bg-white z-10">
              {getParticipantName(getOtherParticipant(conversations.find(c => c.id === activeConvId), currentUserId))}
            </div>

            {/* Message Area */}
            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-gray-50/30">
              {loadingMsg ? (
                <div className="text-center text-sm text-subtle animate-pulse">Loading conversation history...</div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = currentUserId ? msg.sender_id === currentUserId : (msg.sender_id !== conversations.find(c => c.id === activeConvId)?.participant?.id);
                  return (
                    <div
                      key={msg.id || idx}
                      className={`p-3 px-4 rounded-[16px] max-w-[70%] text-sm shadow-sm transition-all animate-fade-in flex flex-col gap-1 ${
                        isMe
                          ? 'self-end bg-navy text-white rounded-tr-none'
                          : 'self-start bg-white border border-gray-100 text-body rounded-tl-none'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <span className="text-[10px] opacity-70 self-end mt-1 font-medium">
                        {new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input form bar */}
            <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-3 bg-white z-10">
              <input
                type="text"
                placeholder="Type your message..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="flex-1 px-4 py-3 rounded-[16px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
              <button
                type="submit"
                className="bg-navy hover:bg-navy-mid text-white font-bold px-6 py-3 rounded-[16px] text-sm transition-colors shadow-sm"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex justify-center items-center text-subtle text-sm font-semibold">
            Select an inbox conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  );
};
