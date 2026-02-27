'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface Conversation {
  user: { id: string; name: string; avatar?: string };
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  sentAt: string;
  sender: { id: string; name: string; avatar?: string };
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatar?: string; courseOfStudy?: string; university?: { name: string } };
  _count: { likes: number; comments: number };
  liked?: boolean;
}

export default function NetworkingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'messaggi' | 'esplora'>('messaggi');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'messaggi') {
      loadConversations();
    } else {
      loadPosts();
    }
  }, [tab]);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser.id);
      const socket = getSocket();
      socket.on('new_message', (msg: Message) => {
        if (msg.senderId === selectedUser.id) {
          setMessages((prev) => [...prev, msg]);
        }
      });
      return () => { socket.off('new_message'); };
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/messages/conversations');
      setConversations(data);
    } catch {} finally { setLoading(false); }
  };

  const loadMessages = async (userId: string) => {
    try {
      const { data } = await api.get(`/messages/${userId}`);
      setMessages(data);
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    try {
      const socket = getSocket();
      socket.emit('send_message', { receiverId: selectedUser.id, content: newMessage });
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        senderId: user!.id,
        content: newMessage,
        sentAt: new Date().toISOString(),
        sender: { id: user!.id, name: user!.name },
      }]);
      setNewMessage('');
    } catch {}
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/posts');
      setPosts(data);
    } catch {} finally { setLoading(false); }
  };

  const submitPost = async () => {
    if (!newPost.trim()) return;
    try {
      const { data } = await api.post('/posts', { content: newPost });
      setPosts((prev) => [data, ...prev]);
      setNewPost('');
    } catch {}
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    try {
      if (liked) {
        await api.delete(`/posts/${postId}/like`);
      } else {
        await api.post(`/posts/${postId}/like`);
      }
      setPosts((prev) => prev.map((p) =>
        p.id === postId ? { ...p, liked: !liked, _count: { ...p._count, likes: p._count.likes + (liked ? -1 : 1) } } : p
      ));
    } catch {}
  };

  const sendFriendRequest = async (toUserId: string) => {
    try {
      await api.post('/friends/request', { toUserId });
    } catch {}
  };

  return (
    <div className="px-4 py-4">
      <h2 className="text-2xl font-display font-bold mb-4">Networking</h2>

      {/* Tabs */}
      <div className="flex bg-card rounded-xl p-1 mb-4">
        <button
          onClick={() => { setTab('messaggi'); setSelectedUser(null); }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'messaggi' ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          Messaggi
        </button>
        <button
          onClick={() => setTab('esplora')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'esplora' ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          Esplora
        </button>
      </div>

      {/* Messages Tab */}
      {tab === 'messaggi' && !selectedUser && (
        <div className="space-y-2">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 bg-border rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-border rounded w-1/2 mb-1" />
                  <div className="h-3 bg-border rounded w-3/4" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <p>Nessun messaggio ancora</p>
              <p className="text-sm mt-1">Connettiti con altri studenti nella sezione Esplora!</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.user.id}
                onClick={() => setSelectedUser(conv.user)}
                className="card w-full text-left flex items-center gap-3 hover:bg-card-hover transition-colors"
              >
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-lg font-bold text-primary">
                  {conv.user.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{conv.user.name}</span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(conv.lastMessageAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 bg-primary text-white text-[10px] rounded-full flex items-center justify-center">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Chat View */}
      {tab === 'messaggi' && selectedUser && (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-text-secondary mb-3 text-sm"
          >
            ← {selectedUser.name}
          </button>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.senderId === user?.id
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-card text-text-primary rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Scrivi un messaggio..."
              className="input-field flex-1"
            />
            <button onClick={sendMessage} className="btn-primary px-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Explore Tab - Social Feed */}
      {tab === 'esplora' && (
        <div className="space-y-4">
          {/* New post input */}
          <div className="card">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Condividi qualcosa con la community..."
              className="input-field resize-none mb-3"
              rows={3}
            />
            <button onClick={submitPost} disabled={!newPost.trim()} className="btn-primary text-sm disabled:opacity-50">
              Pubblica
            </button>
          </div>

          {loading ? (
            [1, 2].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-border rounded-full" />
                  <div className="h-4 bg-border rounded w-1/3" />
                </div>
                <div className="h-16 bg-border rounded" />
              </div>
            ))
          ) : (
            posts.map((post) => (
              <div key={post.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                      {post.author.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-text-primary">{post.author.name}</p>
                      <p className="text-[10px] text-text-muted">
                        {post.author.university?.name} {post.author.courseOfStudy && `· ${post.author.courseOfStudy}`}
                      </p>
                    </div>
                  </div>
                  {post.author.id !== user?.id && (
                    <button
                      onClick={() => sendFriendRequest(post.author.id)}
                      className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-full hover:bg-primary/10 transition-colors"
                    >
                      Connetti
                    </button>
                  )}
                </div>

                <p className="text-sm text-text-primary mb-3 whitespace-pre-wrap">{post.content}</p>

                <div className="flex items-center gap-4 text-text-muted text-sm">
                  <button
                    onClick={() => toggleLike(post.id, !!post.liked)}
                    className={`flex items-center gap-1 transition-colors ${post.liked ? 'text-error' : 'hover:text-error'}`}
                  >
                    {post.liked ? '❤️' : '🤍'} {post._count.likes}
                  </button>
                  <span className="flex items-center gap-1">💬 {post._count.comments}</span>
                  <span className="text-[10px] ml-auto">
                    {new Date(post.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
