// services/socket.ts
// Socket.IO client singleton for real-time messaging

import { io, Socket } from 'socket.io-client';
import { storage } from './api';

type SocketEventCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<Socket> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, SocketEventCallback[]> = new Map();

  /**
   * Get backend socket URL
   */
  private getSocketURL(): string {
    const socketURL = 'https://dios-mnxg.onrender.com';
    console.log('📡 Socket URL:', socketURL);
    return socketURL;
  }

  /**
   * Connect to Socket.IO server
   */
  async connect(): Promise<Socket> {
    // Return existing connection if already connected
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Return pending connection promise if connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const token = await storage.getItem('userToken');
        
        if (!token) {
          console.error('❌ No authentication token found');
          throw new Error('No authentication token found');
        }

        const socketURL = this.getSocketURL();
        console.log('🔌 Connecting to Socket.IO:', socketURL);
        console.log('🔑 Token available:', !!token, 'Length:', token?.length);

        this.socket = io(socketURL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          timeout: 20000,
        });

        // Connection successful
        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected:', this.socket?.id);
          this.reconnectAttempts = 0;
          
          // Re-emit all registered events after reconnection
          this.reattachEventHandlers();
        });

        // Connection error
        this.socket.on('connect_error', (error: any) => {
          console.error('❌ Socket.IO connection error:', error.message);
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.disconnect();
          }
        });

        // Disconnection
        this.socket.on('disconnect', (reason: string) => {
          console.log('🔌 Socket.IO disconnected:', reason);
          
          // Auto-reconnect on unexpected disconnections
          if (reason === 'io server disconnect') {
            // Server disconnected, manually reconnect
            this.socket?.connect();
          }
        });

        // Authentication error
        this.socket.on('error', (error: any) => {
          console.error('Socket.IO error:', error);
          reject(error);
        });

        // Wait for connection
        await new Promise<void>((resolveConnect, rejectConnect) => {
          const timeout = setTimeout(() => {
            rejectConnect(new Error('Socket connection timeout'));
          }, 10000);

          this.socket!.once('connect', () => {
            clearTimeout(timeout);
            resolveConnect();
          });

          this.socket!.once('connect_error', (err: any) => {
            clearTimeout(timeout);
            rejectConnect(err);
          });
        });

        resolve(this.socket);
      } catch (error) {
        console.error('Failed to connect socket:', error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting socket...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.connectionPromise = null;
      this.eventHandlers.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /**
   * Join a conversation room
   */
  async joinConversation(conversationId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const socket = await this.connect();
        
        socket.emit('conversation:join', { conversationId }, (response: any) => {
          if (response?.success) {
            console.log(`✅ Joined conversation: ${conversationId}`);
            resolve();
          } else {
            console.error('Failed to join conversation:', response?.error);
            reject(new Error(response?.error || 'Failed to join conversation'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Leave a conversation room
   */
  async leaveConversation(conversationId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.socket || !this.socket.connected) {
          resolve(); // Already disconnected
          return;
        }

        this.socket.emit('conversation:leave', { conversationId }, (response: any) => {
          if (response?.success || !response) {
            console.log(`👋 Left conversation: ${conversationId}`);
            resolve();
          } else {
            reject(new Error(response?.error || 'Failed to leave conversation'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a message via socket
   */
  async sendMessage(
    conversationId: string,
    content: string,
    messageType: string = 'text',
    attachmentUrl?: string
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const socket = await this.connect();
        
        socket.emit('message:send', {
          conversationId,
          content,
          messageType,
          attachmentUrl
        }, (response: any) => {
          if (response?.success) {
            resolve(response.message);
          } else {
            reject(new Error(response?.error || 'Failed to send message'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Mark conversation as read via socket
   */
  async markConversationRead(conversationId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const socket = await this.connect();
        
        socket.emit('conversation:read', { conversationId }, (response: any) => {
          if (response?.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Failed to mark as read'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Listen for new messages
   */
  async onNewMessage(callback: (data: { message: any; conversationId: string }) => void): Promise<void> {
    const socket = await this.connect();
    
    // Store handler for reconnection
    this.addEventHandler('message:new', callback);
    
    socket.on('message:new', callback);
  }

  /**
   * Remove new message listener
   */
  offNewMessage(callback?: SocketEventCallback): void {
    if (this.socket) {
      if (callback) {
        this.socket.off('message:new', callback);
        this.removeEventHandler('message:new', callback);
      } else {
        this.socket.off('message:new');
        this.eventHandlers.delete('message:new');
      }
    }
  }

  /**
   * Store event handler for reconnection
   */
  private addEventHandler(event: string, callback: SocketEventCallback): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }

  /**
   * Remove specific event handler
   */
  private removeEventHandler(event: string, callback: SocketEventCallback): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Reattach all event handlers after reconnection
   */
  private reattachEventHandlers(): void {
    if (!this.socket) return;

    this.eventHandlers.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket!.on(event, callback);
      });
    });
  }

  /**
   * Get socket instance (for direct access if needed)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Export types
export type { Socket };
