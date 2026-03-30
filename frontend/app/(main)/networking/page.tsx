'use client';

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language';
import { getSocket } from '@/lib/socket';
import CreateGroupModal from '@/components/CreateGroupModal';
import GroupOptionsModal from '@/components/GroupOptionsModal';
import ChatHeader from '@/components/ChatHeader';
import ActionMenu from '@/components/ActionMenu';
import NewChatModal from '@/components/NewChatModal';
import ImageLightbox from '@/components/ImageLightbox';
import { isValidImageUrl } from '@/lib/urlValidation';
import { Plus, UserIcon, ChatDots, CloseSm, CloseMd, ImageIcon, PaperPlane, Check, Heart, Chat, Send } from '@/components/icons';

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
  lastMessage: { content: string; images?: string[]; sentAt: string; sender: { id: string; name: string } } | null;
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
  images?: string[];
  sentAt: string;
  sender: { id: string; name: string; avatar?: string };
}

interface Post {
  id: string;
  content: string;
  images?: string[];
  createdAt: string;
  author: { id: string; name: string; avatar?: string; courseOfStudy?: string; university?: { name: string } };
  _count: { likes: number; comments: number };
  liked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatar?: string };
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
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'messaggi' | 'esplora'>('messaggi');
  const [unifiedConversations, setUnifiedConversations] = useState<UnifiedConversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; avatar?: string; university?: string; canMessage?: boolean } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; memberCount: number; image?: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [postImages, setPostImages] = useState<string[]>([]);
  const postFileInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<
    Record<string, { status: string | null; requestId: string | null; fromUserId: string | null }>
  >({});
  const [chatImages, setChatImages] = useState<string[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [convPage, setConvPage] = useState(1);
  const [convTotalPages, setConvTotalPages] = useState(1);
  const [loadingMoreConv, setLoadingMoreConv] = useState(false);
  const [postPage, setPostPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  function compressImage(file: File, maxSize = 800): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
          } else {
            if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handlePostImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - postImages.length;
    const toProcess = files.slice(0, remaining);
    const compressed = await Promise.all(toProcess.map((f) => compressImage(f)));
    setPostImages((prev) => [...prev, ...compressed]);
    e.target.value = '';
  };

  const removePostImage = (index: number) => {
    setPostImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChatImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - chatImages.length;
    const toProcess = files.slice(0, remaining);
    const compressed = await Promise.all(toProcess.map((f) => compressImage(f)));
    setChatImages((prev) => [...prev, ...compressed]);
    e.target.value = '';
  };

  const removeChatImage = (index: number) => {
    setChatImages((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    setPinnedIds(getPinnedIds());
  }, []);

  // Open a direct chat from external navigation (e.g. message button in pathmates list)
  useEffect(() => {
    const openChatId = searchParams.get('openChat');
    const openChatName = searchParams.get('name');
    const openChatAvatar = searchParams.get('avatar');
    if (openChatId && openChatName) {
      setTab('messaggi');
      setSelectedGroup(null);
      setChatImages([]);
      setSelectedUser({ id: openChatId, name: decodeURIComponent(openChatName), avatar: openChatAvatar ? decodeURIComponent(openChatAvatar) || undefined : undefined });
      router.replace('/networking');
    }
  }, [searchParams]);

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
      lastMessage: g.lastMessage
        ? `${g.lastMessage.sender.name}: ${g.lastMessage.images && g.lastMessage.images.length > 0 && !g.lastMessage.content ? '📷 Foto' : g.lastMessage.content}`
        : t.networking.noMessagePreview,
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
  }, [t]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, groupRes] = await Promise.all([
        api.get('/messages/conversations'),
        api.get('/groups'),
      ]);
      const pinned = getPinnedIds();
      setPinnedIds(pinned);
      const convData = convRes.data.data || convRes.data;
      if (convRes.data.totalPages) setConvTotalPages(convRes.data.totalPages);
      setConvPage(1);
      setUnifiedConversations(buildUnifiedList(convData, groupRes.data, pinned));
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [buildUnifiedList]);

  const loadMoreConversations = useCallback(async () => {
    if (loadingMoreConv || convPage >= convTotalPages) return;
    setLoadingMoreConv(true);
    try {
      const nextPage = convPage + 1;
      const [convRes, groupRes] = await Promise.all([
        api.get(`/messages/conversations?page=${nextPage}&limit=20`),
        api.get('/groups'),
      ]);
      const pinned = getPinnedIds();
      const convData = convRes.data.data || convRes.data;
      const newItems = buildUnifiedList(convData, groupRes.data, pinned);
      setUnifiedConversations((prev) => {
        const existingIds = new Set(prev.map(c => c.id));
        const unique = newItems.filter(item => !existingIds.has(item.id));
        return [...prev, ...unique];
      });
      setConvPage(nextPage);
      if (convRes.data.totalPages) setConvTotalPages(convRes.data.totalPages);
    } catch (err) {
      console.error('Failed to load more conversations:', err);
    } finally {
      setLoadingMoreConv(false);
    }
  }, [convPage, convTotalPages, loadingMoreConv, buildUnifiedList]);

  useEffect(() => {
    if (tab === 'messaggi') {
      loadConversations();
    } else {
      loadPosts();
    }
  }, [tab, loadConversations]);

  // Auto-open chat when coming from profile page
  useEffect(() => {
    const stored = localStorage.getItem('openChatWith');
    if (!stored) return;
    try {
      const chatWith = JSON.parse(stored) as { id: string; name: string; avatar?: string };
      localStorage.removeItem('openChatWith');
      setTab('messaggi');
      setSelectedGroup(null);
      setSelectedUser({ id: chatWith.id, name: chatWith.name, avatar: chatWith.avatar });
    } catch {}
  }, []);

  // Global socket listener — keeps the conversation list up-to-date and
  // delivers messages even when no specific chat is open.
  useEffect(() => {
    if (tab !== 'messaggi') return;
    const socket = getSocket();

    const handleNewMessage = (msg: Message & { receiverId?: string }) => {
      let isChatOpen = false;

      // Update the open chat if applicable
      setSelectedUser((current) => {
        if (current && msg.senderId === current.id) {
          isChatOpen = true;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        return current;
      });

      // Update conversation list preview / unread count
      setUnifiedConversations((prev) => {
        const convId = `direct-${msg.senderId}`;
        const idx = prev.findIndex((c) => c.id === convId);
        if (idx === -1) {
          // New conversation from someone not yet in the list — reload
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const conv = { ...updated[idx] };
        conv.lastMessage = msg.content || (msg.images?.length ? '📷 Foto' : '');
        conv.lastMessageAt = msg.sentAt;
        if (!isChatOpen) {
          conv.unread += 1;
        }
        updated.splice(idx, 1);
        // Re-insert respecting pinned order
        const insertIdx = updated.findIndex((c) => !c.pinned);
        if (conv.pinned || insertIdx === -1) {
          updated.unshift(conv);
        } else {
          updated.splice(insertIdx, 0, conv);
        }
        return updated;
      });
    };

    const handleNewGroupMessage = (msg: Message & { groupId?: string }) => {
      // Update the open group chat if applicable
      setSelectedGroup((current) => {
        if (current && msg.groupId === current.id) {
          setGroupMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        return current;
      });

      // Update conversation list preview
      if (msg.groupId) {
        setUnifiedConversations((prev) => {
          const convId = `group-${msg.groupId}`;
          const idx = prev.findIndex((c) => c.id === convId);
          if (idx === -1) return prev;
          const updated = [...prev];
          const conv = { ...updated[idx] };
          conv.lastMessage = `${msg.sender?.name || ''}: ${msg.content || (msg.images?.length ? '📷 Foto' : '')}`;
          conv.lastMessageAt = msg.sentAt;
          updated.splice(idx, 1);
          const insertIdx = updated.findIndex((c) => !c.pinned);
          if (conv.pinned || insertIdx === -1) {
            updated.unshift(conv);
          } else {
            updated.splice(insertIdx, 0, conv);
          }
          return updated;
        });
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('new_group_message', handleNewGroupMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('new_group_message', handleNewGroupMessage);
    };
  }, [tab, loadConversations]);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser.id);
      // Reset unread counter for this conversation
      setUnifiedConversations((prev) =>
        prev.map((c) => c.id === `direct-${selectedUser.id}` ? { ...c, unread: 0 } : c),
      );
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      api.get(`/profile/${selectedUser.id}`)
        .then(({ data }) => {
          setSelectedUser(prev => prev ? {
            ...prev,
            university: data.university?.name ?? prev.university,
            canMessage: data.canMessage,
          } : prev);
        })
        .catch((err) => {
          console.error('Failed to fetch user profile:', err);
        });
    }
  }, [selectedUser?.id]);

  // Auto-select chat user from query parameter (e.g. /networking?chat=userId)
  useEffect(() => {
    const chatUserId = searchParams.get('chat');
    if (chatUserId && !selectedUser) {
      api.get(`/profile/${chatUserId}`)
        .then(({ data }) => {
          setSelectedUser({
            id: data.id,
            name: data.name,
            avatar: data.avatar,
            university: data.university?.name,
          });
          setTab('messaggi');
        })
        .catch((err) => console.error('Failed to load chat user:', err));
    }
  }, [searchParams]);

  // Lock page scroll when in chat mode so scrollIntoView only affects the messages container
  useEffect(() => {
    if (selectedUser || selectedGroup) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [selectedUser, selectedGroup]);

  // Reset page scroll when mobile keyboard opens/closes
  useEffect(() => {
    if (!(selectedUser || selectedGroup)) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      window.scrollTo(0, 0);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, [selectedUser, selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [messages]);

  const loadMessages = async (userId: string) => {
    try {
      const { data } = await api.get(`/messages/${userId}`);
      setMessages(data.data || data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    if (!selectedUser) return;
    try {
      const socket = getSocket();
      const images = chatImages.length > 0 ? chatImages : undefined;
      socket.emit('send_message', { receiverId: selectedUser.id, content: newMessage || '', images });
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        senderId: user!.id,
        content: newMessage || '',
        images: images || [],
        sentAt: new Date().toISOString(),
        sender: { id: user!.id, name: user!.name },
      }]);
      setNewMessage('');
      setChatImages([]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const loadGroupMessages = async (groupId: string) => {
    try {
      const { data } = await api.get(`/messages/group/${groupId}`);
      setGroupMessages(data.data || data);
    } catch (err) {
      console.error('Failed to load group messages:', err);
    }
  };

  const sendGroupMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    if (!selectedGroup) return;
    try {
      const socket = getSocket();
      const images = chatImages.length > 0 ? chatImages : undefined;
      socket.emit('send_group_message', { groupId: selectedGroup.id, content: newMessage || '', images });
      setGroupMessages((prev) => [...prev, {
        id: Date.now().toString(),
        senderId: user!.id,
        content: newMessage || '',
        images: images || [],
        sentAt: new Date().toISOString(),
        sender: { id: user!.id, name: user!.name },
      }]);
      setNewMessage('');
      setChatImages([]);
    } catch (err) {
      console.error('Failed to send group message:', err);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMessages(selectedGroup.id);
      // Reset unread counter for this group conversation
      setUnifiedConversations((prev) =>
        prev.map((c) => c.id === `group-${selectedGroup.id}` ? { ...c, unread: 0 } : c),
      );
    }
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [groupMessages]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/posts?page=1');
      setPosts(data);
      setHasMorePosts(data.length >= 20);
      setPostPage(1);
      const authorIds = [...new Set(data.map((p: Post) => p.author.id).filter((id: string) => id !== user?.id))] as string[];
      if (authorIds.length > 0) {
        const { data: statuses } = await api.post('/friends/status/batch', { userIds: authorIds });
        setConnectionStatuses(statuses);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally { setLoading(false); }
  };

  const loadMorePosts = async () => {
    if (loadingMorePosts || !hasMorePosts) return;
    setLoadingMorePosts(true);
    try {
      const nextPage = postPage + 1;
      const { data } = await api.get(`/posts?page=${nextPage}`);
      setPosts((prev) => [...prev, ...data]);
      setPostPage(nextPage);
      setHasMorePosts(data.length >= 20);
    } catch (err) {
      console.error('Failed to load more posts:', err);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const submitPost = async () => {
    if (!newPost.trim() && postImages.length === 0) return;
    try {
      const { data } = await api.post('/posts', { content: newPost, images: postImages });
      setPosts((prev) => [data, ...prev]);
      setNewPost('');
      setPostImages([]);
    } catch (err) {
      console.error('Failed to submit post:', err);
    }
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
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const openComments = async (post: Post) => {
    setCommentPost(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      const { data } = await api.get(`/posts/${post.id}/comments`);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !commentPost || commentSending) return;
    setCommentSending(true);
    try {
      const { data } = await api.post(`/posts/${commentPost.id}/comments`, { content: newComment });
      setComments((prev) => [...prev, data]);
      setNewComment('');
      setPosts((prev) => prev.map((p) =>
        p.id === commentPost.id ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p
      ));
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setCommentSending(false);
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    try {
      await api.post('/friends/request', { toUserId });
      setConnectionStatuses(prev => ({
        ...prev,
        [toUserId]: { status: 'PENDING', requestId: null, fromUserId: user!.id },
      }));
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
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
      setChatImages([]);
      setSelectedUser({ id: conv.userId, name: conv.name, avatar: conv.avatar });
    } else if (conv.type === 'group' && conv.groupId) {
      setSelectedUser(null);
      setChatImages([]);
      setSelectedGroup({ id: conv.groupId, name: conv.name, memberCount: conv.memberCount || 0, image: conv.avatar });
    }
  };

  const openGroupOptions = async () => {
    if (!selectedGroup) return;
    try {
      const { data } = await api.get(`/groups/${selectedGroup.id}`);
      setGroupDetails(data);
      setShowGroupOptions(true);
    } catch (err) {
      console.error('Failed to open group options:', err);
    }
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
      } catch (err) {
        console.error('Failed to reload group details:', err);
      }
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
    <div className={selectedUser || selectedGroup
      ? 'fixed inset-0 z-[60] flex flex-col bg-[#0D1117] overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
      : 'px-2 pt-2 pb-4'
    }>

      {!selectedUser && !selectedGroup && (
        <>
          {/* Sub-header */}
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-white font-medium text-lg">Chat</h1>
              <p className="text-gray-500 text-sm">
                {unifiedConversations.length} {unifiedConversations.length === 1 ? t.networking.conversationsSingular : t.networking.conversationsPlural}
              </p>
            </div>
            <button
              onClick={() => setShowActionMenu(true)}
              className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105"
              style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}
              title={t.networking.createGroup}
            >
              <Plus size={24} strokeWidth={2.5} />
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
              {t.networking.messages}
            </button>
            <button
              onClick={() => setTab('esplora')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === 'esplora'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'text-gray-500'
              }`}
            >
              {t.networking.explore}
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
              <p>{t.networking.noMessages}</p>
              <p className="text-sm mt-1">{t.networking.connectExplore}</p>
            </div>
          ) : (
            unifiedConversations.map((conv) => (
              <div
                key={conv.id}
                className="bg-[#1a1b2e] rounded-2xl p-4 mb-3 w-full text-left flex items-center gap-3 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10"
                style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)' }}
              >
                {/* Avatar — navigates to profile for direct chats */}
                <div
                  className="relative shrink-0"
                  onClick={() => conv.type === 'direct' && conv.userId
                    ? router.push(`/profile/${conv.userId}`)
                    : handleConversationClick(conv)}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer ${conv.name ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-[#1E293B]'}`}
                    style={conv.name ? { boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' } : undefined}
                  >
                    {conv.avatar && isValidImageUrl(conv.avatar) ? (
                      <img src={conv.avatar} alt={conv.name} className="w-14 h-14 rounded-full object-cover" />
                    ) : !conv.name ? (
                      <UserIcon size={28} className="text-[#475569]" />
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

                {/* Rest of row — opens chat */}
                <button className="flex-1 min-w-0 text-left" onClick={() => handleConversationClick(conv)}>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center min-w-0">
                      <span className={`font-medium truncate ${conv.name ? 'text-white' : 'text-[#64748B] italic'}`}>{conv.name || 'Utente eliminato'}</span>
                      {conv.type === 'group' && (
                        <span className="ml-2 text-xs text-indigo-400">{t.networking.group}</span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs shrink-0 ml-2">
                      {new Date(conv.lastMessageAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm truncate">{conv.lastMessage}</p>
                </div>
                </button>
              </div>
            ))
          )}
          {convPage < convTotalPages && (
            <button
              onClick={loadMoreConversations}
              disabled={loadingMoreConv}
              className="w-full py-3 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
            >
              {loadingMoreConv ? 'Caricamento...' : 'Carica altro'}
            </button>
          )}
        </div>
      )}

      {/* Direct Chat View */}
      {tab === 'messaggi' && selectedUser && (
        <div className="flex flex-col flex-1 min-h-0">
          <ChatHeader
            type="individual"
            user={{ id: selectedUser.id, name: selectedUser.name, avatar: selectedUser.avatar, university: selectedUser.university }}
            onBack={() => { setSelectedUser(null); loadConversations(); }}
            onPress={() => router.push(`/profile/${selectedUser.id}`)}
          />
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 scrollbar-hide">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-12">
                <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mb-1">
                  <ChatDots size={28} className="text-indigo-400" />
                </div>
                <p className="text-gray-400 text-sm">
                  {selectedUser.name
                    ? <>Inizia una conversazione con <span className="text-white font-medium">{selectedUser.name}</span></>
                    : 'Questo account è stato eliminato'}
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${
                  msg.senderId === user?.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-md'
                    : 'bg-[#1a1b2e] text-white rounded-2xl rounded-bl-md'
                } ${msg.images && msg.images.length > 0 ? 'p-1.5' : 'px-4 py-2.5'}`}>
                  {msg.images && msg.images.length > 0 && (
                    <div className={`${msg.images.length === 1 ? '' : 'grid grid-cols-2 gap-1'} mb-${msg.content ? '1.5' : '0'}`}>
                      {msg.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox({ images: msg.images!, index: i })}
                          className={`block overflow-hidden rounded-xl ${msg.images!.length === 1 ? 'w-full' : ''} ${msg.images!.length % 2 !== 0 && i === msg.images!.length - 1 ? 'col-span-2' : ''}`}
                        >
                          <img src={img} alt="" className={`w-full object-cover ${msg.images!.length === 1 ? 'max-h-64 rounded-xl' : 'h-32'}`} />
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.content && (
                    <p className={`text-sm ${msg.images && msg.images.length > 0 ? 'px-2.5 pb-1.5 pt-1' : ''}`}>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div>
            {chatImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mb-2 pb-1 scrollbar-hide">
                {chatImages.map((img, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={img} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    <button
                      onClick={() => removeChatImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                    >
                      <CloseSm size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {selectedUser?.canMessage === false || !selectedUser?.name ? (
              <div className="flex items-center justify-center py-3 text-sm text-gray-500 italic">
                {!selectedUser?.name ? 'Questo account è stato eliminato' : 'Questo utente non accetta messaggi'}
              </div>
            ) : (
            <div className="flex gap-2">
              <button
                onClick={() => chatFileInputRef.current?.click()}
                disabled={chatImages.length >= 5}
                className="w-12 h-12 bg-[#1a1b2e] border border-indigo-900/30 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-400 shrink-0 disabled:opacity-40 transition-colors"
              >
                <ImageIcon size={20} strokeWidth={2} />
              </button>
              <input
                ref={chatFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleChatImageSelect}
                className="hidden"
              />
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={t.networking.writeMessage}
                className="flex-1 bg-[#1a1b2e] text-white border border-indigo-900/30 focus:border-indigo-500 rounded-2xl px-4 py-3 placeholder:text-gray-500 focus:outline-none transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() && chatImages.length === 0}
                className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shrink-0 hover:scale-105 transition-transform disabled:opacity-40"
                style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}
              >
                <Send size={20} strokeWidth={2} />
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Group Chat View */}
      {tab === 'messaggi' && selectedGroup && !selectedUser && (
        <div className="flex flex-col flex-1 min-h-0">
          <ChatHeader
            type="group"
            group={{ id: selectedGroup.id, name: selectedGroup.name, image: selectedGroup.image }}
            onBack={() => { setSelectedGroup(null); loadConversations(); }}
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
                    <p className="text-[10px] text-indigo-400 mb-0.5 ml-1">{msg.sender?.name || 'Utente eliminato'}</p>
                  )}
                  <div className={`${
                    msg.senderId === user?.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-[#1a1b2e] text-white rounded-2xl rounded-bl-md'
                  } ${msg.images && msg.images.length > 0 ? 'p-1.5' : 'px-4 py-2.5'}`}>
                    {msg.images && msg.images.length > 0 && (
                      <div className={`${msg.images.length === 1 ? '' : 'grid grid-cols-2 gap-1'} mb-${msg.content ? '1.5' : '0'}`}>
                        {msg.images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setLightbox({ images: msg.images!, index: i })}
                            className={`block overflow-hidden rounded-xl ${msg.images!.length === 1 ? 'w-full' : ''} ${msg.images!.length % 2 !== 0 && i === msg.images!.length - 1 ? 'col-span-2' : ''}`}
                          >
                            <img src={img} alt="" className={`w-full object-cover ${msg.images!.length === 1 ? 'max-h-64 rounded-xl' : 'h-32'}`} />
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <p className={`text-sm ${msg.images && msg.images.length > 0 ? 'px-2.5 pb-1.5 pt-1' : ''}`}>{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div>
            {chatImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mb-2 pb-1 scrollbar-hide">
                {chatImages.map((img, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={img} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    <button
                      onClick={() => removeChatImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                    >
                      <CloseSm size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => chatFileInputRef.current?.click()}
                disabled={chatImages.length >= 5}
                className="w-12 h-12 bg-[#1a1b2e] border border-indigo-900/30 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-400 shrink-0 disabled:opacity-40 transition-colors"
              >
                <ImageIcon size={20} />
              </button>
              <input
                ref={chatFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleChatImageSelect}
                className="hidden"
              />
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendGroupMessage()}
                placeholder={t.networking.writeMessage}
                className="flex-1 bg-[#1a1b2e] text-white border border-indigo-900/30 focus:border-indigo-500 rounded-2xl px-4 py-3 placeholder:text-gray-500 focus:outline-none transition-colors"
              />
              <button
                onClick={sendGroupMessage}
                disabled={!newMessage.trim() && chatImages.length === 0}
                className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shrink-0 hover:scale-105 transition-transform disabled:opacity-40"
                style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}
              >
                <Send size={20} />
              </button>
            </div>
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
              placeholder={t.networking.shareWithCommunity}
              className="input-field resize-none mb-3"
              rows={3}
            />

            {/* Image upload section */}
            {postImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto mb-3 pb-1 scrollbar-hide">
                {postImages.map((img, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={img} alt="" className="w-[72px] h-[72px] rounded-xl object-cover" />
                    <button
                      onClick={() => removePostImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                    >
                      <CloseSm size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => postFileInputRef.current?.click()}
                disabled={postImages.length >= 5}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ImageIcon size={20} />
                {t.networking.addPhoto} ({postImages.length}/5)
              </button>
              <input
                ref={postFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePostImageSelect}
                className="hidden"
              />
              <button
                onClick={submitPost}
                disabled={!newPost.trim() && postImages.length === 0}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {t.networking.publish}
              </button>
            </div>
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
                  <button
                    className="flex items-center gap-3 text-left"
                    onClick={() => post.author?.id && post.author.id !== user?.id && router.push(`/profile/${post.author.id}`)}
                  >
                    {(() => {
                      const isDeleted = !post.author?.name;
                      const avatar = isDeleted ? null : (post.author.id === user?.id
                        ? (user?.avatar ?? post.author.avatar)
                        : post.author.avatar);
                      return (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 ${isDeleted ? 'bg-[#1E293B]' : 'bg-primary/20 text-primary'}`}>
                          {isDeleted ? (
                            <UserIcon size={20} color="#475569" strokeWidth={1.5} />
                          ) : avatar ? (
                            <img src={avatar} alt={post.author.name} className="w-full h-full object-cover" />
                          ) : (
                            post.author.name[0]
                          )}
                        </div>
                      );
                    })()}
                    <div>
                      <p className={`font-medium text-sm ${post.author?.id && post.author.id !== user?.id ? 'hover:underline text-text-primary' : 'text-text-primary'} ${!post.author?.name ? 'text-[#64748B] italic' : ''}`}>
                        {post.author?.name || 'Utente eliminato'}
                      </p>
                      {post.author?.name && (
                        <p className="text-[10px] text-text-muted">
                          {post.author.university?.name} {post.author.courseOfStudy && `· ${post.author.courseOfStudy}`}
                        </p>
                      )}
                    </div>
                  </button>
                  {post.author?.id && post.author.id !== user?.id && (() => {
                    const cs = connectionStatuses[post.author.id];
                    const status = cs?.status || null;

                    if (status === 'ACCEPTED') {
                      return (
                        <span className="text-xs text-green-400 border border-green-400/30 px-3 py-1 rounded-full flex items-center gap-1">
                          <Check size={12} strokeWidth={2.5} />
                          {t.userProfile.connected}
                        </span>
                      );
                    }
                    if (status === 'PENDING') {
                      return null;
                    }
                    return (
                      <button
                        onClick={() => sendFriendRequest(post.author.id)}
                        className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-full hover:bg-primary/10 transition-colors"
                      >
                        {t.userProfile.connect}
                      </button>
                    );
                  })()}
                </div>

                {post.content && <p className="text-sm text-text-primary mb-3 whitespace-pre-wrap">{post.content}</p>}

                {/* Post images grid */}
                {post.images && post.images.length > 0 && (
                  <div className={`mb-3 rounded-xl overflow-hidden ${
                    post.images.length === 1 ? '' :
                    post.images.length === 2 ? 'grid grid-cols-2 gap-1' :
                    post.images.length === 4 ? 'grid grid-cols-2 gap-1' :
                    ''
                  }`}>
                    {post.images.length === 1 && (
                      <button onClick={() => setLightbox({ images: post.images!, index: 0 })} className="w-full">
                        <img src={post.images[0]} alt="" className="w-full h-48 object-cover rounded-xl" />
                      </button>
                    )}
                    {post.images.length === 2 && post.images.map((img, i) => (
                      <button key={i} onClick={() => setLightbox({ images: post.images!, index: i })}>
                        <img src={img} alt="" className="w-full h-44 object-cover" />
                      </button>
                    ))}
                    {post.images.length === 3 && (
                      <div className="space-y-1">
                        <button onClick={() => setLightbox({ images: post.images!, index: 0 })} className="w-full">
                          <img src={post.images[0]} alt="" className="w-full h-44 object-cover rounded-t-xl" />
                        </button>
                        <div className="grid grid-cols-2 gap-1">
                          {post.images.slice(1).map((img, i) => (
                            <button key={i} onClick={() => setLightbox({ images: post.images!, index: i + 1 })}>
                              <img src={img} alt="" className="w-full h-28 object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {post.images.length === 4 && post.images.map((img, i) => (
                      <button key={i} onClick={() => setLightbox({ images: post.images!, index: i })}>
                        <img src={img} alt="" className="w-full h-36 object-cover" />
                      </button>
                    ))}
                    {post.images.length === 5 && (
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-1">
                          {post.images.slice(0, 2).map((img, i) => (
                            <button key={i} onClick={() => setLightbox({ images: post.images!, index: i })}>
                              <img src={img} alt="" className="w-full h-36 object-cover" />
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {post.images.slice(2).map((img, i) => (
                            <button key={i} onClick={() => setLightbox({ images: post.images!, index: i + 2 })}>
                              <img src={img} alt="" className="w-full h-28 object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 text-text-muted text-sm">
                  <button
                    onClick={() => toggleLike(post.id, !!post.liked)}
                    className={`flex items-center gap-1.5 transition-colors ${post.liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                  >
                    <Heart size={20} filled={!!post.liked} />
                    <span className="text-sm">{post._count.likes}</span>
                  </button>
                  <button
                    onClick={() => openComments(post)}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-indigo-400 transition-colors"
                  >
                    <Chat size={20} />
                    <span className="text-sm">{post._count.comments}</span>
                  </button>
                  <span className="text-[10px] ml-auto">
                    {new Date(post.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))
          )}
          {hasMorePosts && posts.length > 0 && (
            <button
              onClick={loadMorePosts}
              disabled={loadingMorePosts}
              className="w-full py-3 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
            >
              {loadingMorePosts ? 'Caricamento...' : 'Carica altro'}
            </button>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={loadConversations}
      />

      {/* Action Menu */}
      <ActionMenu
        isOpen={showActionMenu}
        onClose={() => setShowActionMenu(false)}
        onNewChat={() => setShowNewChat(true)}
        onCreateGroup={() => setShowCreateGroup(true)}
      />

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onUserSelected={(u) => {
          setShowNewChat(false);
          setSelectedGroup(null);
          setSelectedUser({ id: u.id, name: u.name, avatar: u.avatar });
        }}
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

      {/* Image Lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Comments Modal */}
      {commentPost && (
        <div className="fixed inset-0 bg-black sm:bg-black/60 z-[60] flex items-end sm:items-center justify-center animate-fade-in" onClick={() => { setCommentPost(null); setNewComment(''); }}>
          <div
            className="bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl h-[92dvh] sm:h-auto sm:max-h-[85vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (mobile only) */}
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <h3 className="text-white font-semibold text-lg">Commenti ({comments.length})</h3>
              <button onClick={() => { setCommentPost(null); setNewComment(''); }} className="text-gray-400 hover:text-white p-1">
                <CloseMd size={24} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-3"><Chat size={48} color="#4B5563" strokeWidth={1.5} /></div>
                  <p className="text-gray-500 text-sm">{t.networking.noComments}</p>
                  <p className="text-gray-600 text-xs mt-1">Sii il primo a commentare!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <button
                      onClick={() => c.author?.id && c.author.id !== user?.id && router.push(`/profile/${c.author.id}`)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${c.author?.name ? 'bg-primary/20' : 'bg-[#1E293B]'}`}
                    >
                      {!c.author?.name ? (
                        <UserIcon size={16} color="#475569" strokeWidth={1.5} />
                      ) : c.author.avatar ? (
                        <img src={c.author.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{c.author.name.charAt(0)}</span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <button
                          onClick={() => c.author?.id && c.author.id !== user?.id && router.push(`/profile/${c.author.id}`)}
                          className={`text-sm font-semibold ${c.author?.name ? 'text-white hover:underline' : 'text-[#64748B] italic'}`}
                        >
                          {c.author?.name || 'Utente eliminato'}
                        </button>
                        <span className="text-gray-500 text-xs">
                          {new Date(c.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mt-0.5 break-words">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Input — fixed at bottom, outside scroll area */}
            <div className="border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitComment()}
                placeholder={t.networking.writeComment}
                className="flex-1 bg-card rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-primary"
                maxLength={500}
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim() || commentSending}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity"
              >
                {commentSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={16} color="white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
