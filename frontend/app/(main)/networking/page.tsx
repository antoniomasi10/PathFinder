'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import CreateGroupModal from '@/components/CreateGroupModal';
import GroupOptionsModal from '@/components/GroupOptionsModal';
import ChatHeader from '@/components/ChatHeader';

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
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; avatar?: string; university?: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; memberCount: number; image?: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);
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
    if (selectedUser && !selectedUser.university) {
      api.get(`/profile/${selectedUser.id}`)
        .then(({ data }) => {
          if (data.university?.name) {
            setSelectedUser(prev => prev ? { ...prev, university: data.university.name } : prev);
          }
        })
        .catch(() => {});
    }
  }, [selectedUser?.id]);

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

  const loadGroupMessages = async (groupId: string) => {
    try {
      const { data } = await api.get(`/messages/group/${groupId}`);
      setGroupMessages(data);
    } catch {}
  };

  const sendGroupMessage = async () => {
    if (!newMessage.trim() || !selectedGroup) return;
    try {
      const socket = getSocket();
      socket.emit('send_group_message', { groupId: selectedGroup.id, content: newMessage });
      setGroupMessages((prev) => [...prev, {
        id: Date.now().toString(),
        senderId: user!.id,
        content: newMessage,
        sentAt: new Date().toISOString(),
        sender: { id: user!.id, name: user!.name },
      }]);
      setNewMessage('');
    } catch {}
  };

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMessages(selectedGroup.id);
      const socket = getSocket();
      socket.on('new_group_message', (msg: Message & { groupId?: string }) => {
        if (msg.groupId === selectedGroup.id) {
          setGroupMessages((prev) => [...prev, msg]);
        }
      });
      return () => { socket.off('new_group_message'); };
    }
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

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
      setSelectedGroup(null);
      setSelectedUser({ id: conv.userId, name: conv.name, avatar: conv.avatar });
    } else if (conv.type === 'group' && conv.groupId) {
      setSelectedUser(null);
      setSelectedGroup({ id: conv.groupId, name: conv.name, memberCount: conv.memberCount || 0, image: conv.avatar });
    }
  };

  const openGroupOptions = async () => {
    if (!selectedGroup) return;
    try {
      const { data } = await api.get(`/groups/${selectedGroup.id}`);
      setGroupDetails(data);
      setShowGroupOptions(true);
    } catch {}
  };

  const handleGroupUpdated = async () => {
    setShowGroupOptions(false);
    setGroupDetails(null);
    // Reload group details + conversation list
    if (selectedGroup) {
      try {
        const { data } = await api.get(`/groups/${selectedGroup.id}`);
        setSelectedGroup({ id: data.id, name: data.name, memberCount: data.members.length, image: data.image });
        setGroupDetails(data);
        setShowGroupOptions(true);
      } catch {}
    }
    loadConversations();
  };

  const handleGroupLeft = () => {
    setShowGroupOptions(false);
    setGroupDetails(null);
    setSelectedGroup(null);
    loadConversations();
  };

  return (
    <div className="bg-chat-gradient min-h-screen -mx-4 -mt-4 px-6 pt-6 pb-24">

      {!selectedUser && !selectedGroup && (
        <>
          {/* Sub-header */}
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-white font-medium text-lg">Chat</h1>
              <p className="text-gray-500 text-sm">
                {unifiedConversations.length} conversazion{unifiedConversations.length === 1 ? 'e' : 'i'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105"
              style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}
              title="Crea gruppo"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div
            className="h-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 mb-4"
            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.5)' }}
          />

          {/* Tabs */}
          <div className="bg-[#1a1b2e] rounded-2xl p-1 mb-4 flex">
            <button
              onClick={() => { setTab('messaggi'); setSelectedUser(null); setSelectedGroup(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === 'messaggi'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'text-gray-500'
              }`}
            >
              Messaggi
            </button>
            <button
              onClick={() => setTab('esplora')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === 'esplora'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'text-gray-500'
              }`}
            >
              Esplora
            </button>
          </div>
        </>
      )}

      {/* Messages Tab - Conversation List */}
      {tab === 'messaggi' && !selectedUser && !selectedGroup && (
        <div>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1a1b2e] rounded-2xl p-4 mb-3 animate-pulse flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-700 rounded-full shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-700 rounded w-3/4" />
                </div>
              </div>
            ))
          ) : unifiedConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Nessun messaggio ancora</p>
              <p className="text-sm mt-1">Connettiti con altri studenti nella sezione Esplora!</p>
            </div>
          ) : (
            unifiedConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                className="bg-[#1a1b2e] rounded-2xl p-4 mb-3 w-full text-left flex items-center gap-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10"
                style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)' }}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
                    style={{ boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' }}
                  >
                    {conv.avatar ? (
                      <img src={conv.avatar} alt={conv.name} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <span className="text-white text-lg font-medium">{conv.name[0]}</span>
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ boxShadow: '0 0 15px rgba(99, 102, 241, 0.6)' }}
                    >
                      {conv.unread}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center min-w-0">
                      <span className="text-white font-medium truncate">{conv.name}</span>
                      {conv.type === 'group' && (
                        <span className="ml-2 text-xs text-indigo-400">gruppo</span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs shrink-0 ml-2">
                      {new Date(conv.lastMessageAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm truncate">{conv.lastMessage}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Direct Chat View */}
      {tab === 'messaggi' && selectedUser && (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
          <ChatHeader
            type="individual"
            user={{ id: selectedUser.id, name: selectedUser.name, avatar: selectedUser.avatar, university: selectedUser.university }}
            onBack={() => setSelectedUser(null)}
            onPress={() => {}}
          />
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 scrollbar-hide">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] px-4 py-2.5 text-sm ${
                  msg.senderId === user?.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-md'
                    : 'bg-[#1a1b2e] text-white rounded-2xl rounded-bl-md'
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
              className="flex-1 bg-[#1a1b2e] text-white border border-indigo-900/30 focus:border-indigo-500 rounded-2xl px-4 py-3 placeholder:text-gray-500 focus:outline-none transition-colors"
            />
            <button
              onClick={sendMessage}
              className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shrink-0 hover:scale-105 transition-transform"
              style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Group Chat View */}
      {tab === 'messaggi' && selectedGroup && !selectedUser && (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
          <ChatHeader
            type="group"
            group={{ id: selectedGroup.id, name: selectedGroup.name, image: selectedGroup.image }}
            onBack={() => setSelectedGroup(null)}
            onPress={openGroupOptions}
          />
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 scrollbar-hide">
            {groupMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%]`}>
                  {msg.senderId !== user?.id && (
                    <p className="text-[10px] text-indigo-400 mb-0.5 ml-1">{msg.sender.name}</p>
                  )}
                  <div className={`px-4 py-2.5 text-sm ${
                    msg.senderId === user?.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-[#1a1b2e] text-white rounded-2xl rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendGroupMessage()}
              placeholder="Scrivi un messaggio..."
              className="flex-1 bg-[#1a1b2e] text-white border border-indigo-900/30 focus:border-indigo-500 rounded-2xl px-4 py-3 placeholder:text-gray-500 focus:outline-none transition-colors"
            />
            <button
              onClick={sendGroupMessage}
              className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shrink-0 hover:scale-105 transition-transform"
              style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}
            >
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

      {/* Group Options Modal */}
      {groupDetails && (
        <GroupOptionsModal
          isOpen={showGroupOptions}
          onClose={() => { setShowGroupOptions(false); setGroupDetails(null); }}
          group={groupDetails}
          currentUserId={user?.id || ''}
          onGroupUpdated={handleGroupUpdated}
          onGroupLeft={handleGroupLeft}
        />
      )}
    </div>
  );
}
