'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import CreateGroupModal from '@/components/CreateGroupModal';

interface Conversation {
  user: { id: string; name: string; avatar?: string };
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

interface Group {
  id: string;
  name: string;
  image?: string;
  description?: string;
  members: { user: { id: string; name: string; avatar?: string } }[];
  lastMessage: { content: string; sentAt: string; sender: { id: string; name: string } } | null;
  createdAt: string;
}

interface UnifiedConversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  pinned: boolean;
  userId?: string;
  groupId?: string;
  memberCount?: number;
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

function getPinnedIds(): Set<string> {
  try {
    const stored = localStorage.getItem('pinnedConversations');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids: Set<string>) {
  localStorage.setItem('pinnedConversations', JSON.stringify(Array.from(ids)));
}

export default function NetworkingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'messaggi' | 'esplora'>('messaggi');
  const [unifiedConversations, setUnifiedConversations] = useState<UnifiedConversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPinnedIds(getPinnedIds());
  }, []);

  const buildUnifiedList = useCallback((conversations: Conversation[], groups: Group[], pinned: Set<string>): UnifiedConversation[] => {
    const directItems: UnifiedConversation[] = conversations.map((conv) => ({
      id: `direct-${conv.user.id}`,
      type: 'direct' as const,
      name: conv.user.name,
      avatar: conv.user.avatar,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      unread: conv.unread,
      pinned: pinned.has(`direct-${conv.user.id}`),
      userId: conv.user.id,
    }));

    const groupItems: UnifiedConversation[] = groups.map((g) => ({
      id: `group-${g.id}`,
      type: 'group' as const,
      name: g.name,
      avatar: g.image,
      lastMessage: g.lastMessage ? `${g.lastMessage.sender.name}: ${g.lastMessage.content}` : 'Nessun messaggio',
      lastMessageAt: g.lastMessage?.sentAt || g.createdAt,
      unread: 0,
      pinned: pinned.has(`group-${g.id}`),
      groupId: g.id,
      memberCount: g.members.length,
    }));

    const all = [...directItems, ...groupItems];
    all.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    return all;
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, groupRes] = await Promise.all([
        api.get('/messages/conversations'),
        api.get('/groups'),
      ]);
      const pinned = getPinnedIds();
      setPinnedIds(pinned);
      setUnifiedConversations(buildUnifiedList(convRes.data, groupRes.data, pinned));
    } catch {} finally {
      setLoading(false);
    }
  }, [buildUnifiedList]);

  useEffect(() => {
    if (tab === 'messaggi') {
      loadConversations();
    } else {
      loadPosts();
    }
  }, [tab, loadConversations]);

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

  const togglePin = (convId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      savePinnedIds(next);
      setUnifiedConversations((convs) => {
        const updated = convs.map((c) => c.id === convId ? { ...c, pinned: next.has(convId) } : c);
        updated.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });
        return updated;
      });
      return next;
    });
  };

  const handleConversationClick = (conv: UnifiedConversation) => {
    if (conv.type === 'direct' && conv.userId) {
      setSelectedUser({ id: conv.userId, name: conv.name });
    }
    // Group chat view will be implemented later
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

      {/* Messages Tab - Conversation List */}
      {tab === 'messaggi' && !selectedUser && (
        <div className="space-y-2">
          {/* Create Group Button */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-secondary">Conversazioni</span>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
              title="Crea gruppo"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

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
          ) : unifiedConversations.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <p>Nessun messaggio ancora</p>
              <p className="text-sm mt-1">Connettiti con altri studenti nella sezione Esplora!</p>
            </div>
          ) : (
            unifiedConversations.map((conv) => (
              <div key={conv.id} className="relative">
                <button
                  onClick={() => handleConversationClick(conv)}
                  className="card w-full text-left flex items-center gap-3 hover:bg-card-hover transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-lg font-bold text-primary shrink-0 relative">
                    {conv.type === 'group' ? (
                      <>
                        {conv.name[0]}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-card rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      conv.name[0]
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {conv.pinned && (
                          <svg className="w-3 h-3 text-text-muted shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                        )}
                        <span className="font-medium text-text-primary truncate">{conv.name}</span>
                        {conv.type === 'group' && conv.memberCount && (
                          <span className="text-[10px] text-text-muted shrink-0">({conv.memberCount})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0 ml-2">
                        {new Date(conv.lastMessageAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary truncate">{conv.lastMessage}</p>
                  </div>

                  {conv.unread > 0 && (
                    <span className="w-5 h-5 bg-primary text-white text-[10px] rounded-full flex items-center justify-center shrink-0">
                      {conv.unread}
                    </span>
                  )}
                </button>

                {/* Pin button */}
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
                  className="absolute top-2 right-2 p-1 text-text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  style={{ opacity: conv.pinned ? 1 : undefined }}
                  title={conv.pinned ? 'Rimuovi pin' : 'Fissa in alto'}
                >
                  <svg className="w-3.5 h-3.5" fill={conv.pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                </button>
              </div>
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
          <div className="flex-1 overflow-y-auto space-y-2 mb-3">
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

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={loadConversations}
      />
    </div>
  );
}
