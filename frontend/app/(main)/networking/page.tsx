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
import OpportunityMessageCard from '@/components/OpportunityMessageCard';
import { isValidImageUrl } from '@/lib/urlValidation';
import { checkWarn } from '@/lib/moderation';
import { Plus, UserIcon, ChatDots, CloseSm, CloseMd, ImageIcon, PaperPlane, Check, Heart, Chat, Send, Flag, MoreHorizontal, Trash, Search, Filter } from '@/components/icons';

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
  type?: 'TEXT' | 'OPPORTUNITY';
  opportunityId?: string;
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
    Record<string, { status: string | null; requestId: string | null; direction: 'sent' | 'received' | null }>
  >({});
  const [chatImages, setChatImages] = useState<string[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const msgCache = useRef<Map<string, Message[]>>(new Map());
  const groupMsgCache = useRef<Map<string, Message[]>>(new Map());
  const currentConvIdRef = useRef<string | null>(null);
  const currentGroupIdRef = useRef<string | null>(null);
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
  const [openPostMenu, setOpenPostMenu] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'post'; postId: string } | { type: 'comment'; postId: string; commentId: string } | null>(null);
  const [reportModal, setReportModal] = useState<{ type: 'post' | 'comment'; id: string; postId?: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportedItems, setReportedItems] = useState<Set<string>>(new Set());
  const [reportSending, setReportSending] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [warnPending, setWarnPending] = useState<'post' | 'comment' | null>(null);
  const [blockedToast, setBlockedToast] = useState(false);
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProfileResults, setSearchProfileResults] = useState<{
    id: string; name: string; avatar?: string; courseOfStudy?: string; yearOfStudy?: number;
    university?: { name: string; shortName?: string }; profile?: { clusterTag?: string };
  }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClusterTag, setSelectedClusterTag] = useState<string | null>(null);
  const [profileYearFilter, setProfileYearFilter] = useState<number | null>(null);
  const [coreSkillArea, setCoreSkillArea] = useState<string | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [suggestedProfiles, setSuggestedProfiles] = useState<{
    id: string; name: string; avatar?: string; courseOfStudy?: string; yearOfStudy?: number;
    university?: { name: string; shortName?: string }; profile?: { clusterTag?: string };
  }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const MACRO_AREAS = [
    { id: 'ai', label: 'AI & ML' },
    { id: 'web', label: 'Web Dev' },
    { id: 'data', label: 'Data Science' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'research', label: 'Ricerca' },
    { id: 'business', label: 'Business' },
    { id: 'finance', label: 'Finance' },
    { id: 'design', label: 'Design' },
    { id: 'sustainability', label: 'Sustainability' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'law', label: 'Law & Policy' },
    { id: 'healthcare', label: 'Healthcare' },
  ];
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Navigate to a specific post from notification
  useEffect(() => {
    const postId = searchParams.get('post');
    if (!postId) return;
    setTab('esplora');
    setHighlightPostId(postId);
    router.replace('/networking');
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
      // silent;
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
      // silent;
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

  useEffect(() => {
    loadSuggestions();
  }, []);

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
            const updated = [...prev, msg];
            msgCache.current.set(current.id, updated);
            return updated;
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
        conv.lastMessage = msg.type === 'OPPORTUNITY' ? '📎 Opportunità condivisa' : (msg.content || (msg.images?.length ? '📷 Foto' : ''));
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
            const updated = [...prev, msg];
            groupMsgCache.current.set(current.id, updated);
            return updated;
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

    const handleMessageSent = (msg: Message) => {
      setMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.senderId === msg.senderId && m.id.length < 20);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = msg;
        if (currentConvIdRef.current) msgCache.current.set(currentConvIdRef.current, updated);
        return updated;
      });
    };

    const handleGroupMessageSent = (msg: Message) => {
      setGroupMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.senderId === msg.senderId && m.id.length < 20);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = msg;
        if (currentGroupIdRef.current) groupMsgCache.current.set(currentGroupIdRef.current, updated);
        return updated;
      });
    };

    const handleMessageError = () => {
      setMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.id.length < 20);
        if (idx === -1) return prev;
        return prev.filter((_, i) => i !== idx);
      });
    };

    const handleGroupMessageError = () => {
      setGroupMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.id.length < 20);
        if (idx === -1) return prev;
        return prev.filter((_, i) => i !== idx);
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('new_group_message', handleNewGroupMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('group_message_sent', handleGroupMessageSent);
    socket.on('message_error', handleMessageError);
    socket.on('error', handleMessageError);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('new_group_message', handleNewGroupMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('group_message_sent', handleGroupMessageSent);
      socket.off('message_error', handleMessageError);
      socket.off('error', handleMessageError);
    };
  }, [tab, loadConversations]);

  useEffect(() => {
    if (selectedUser) {
      currentConvIdRef.current = selectedUser.id;
      loadMessages(selectedUser.id);
      // Reset unread counter for this conversation
      setUnifiedConversations((prev) =>
        prev.map((c) => c.id === `direct-${selectedUser.id}` ? { ...c, unread: 0 } : c),
      );
    }
  }, [selectedUser?.id]);

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
          // silent;
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
        .catch(() => {});
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [messages]);

  const loadMessages = async (userId: string) => {
    const cached = msgCache.current.get(userId);
    if (cached) setMessages(cached);
    try {
      const { data } = await api.get(`/messages/${userId}`);
      const msgs = data.data || data;
      msgCache.current.set(userId, msgs);
      setMessages(msgs);
    } catch (err) {
      // silent;
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
      // silent;
    }
  };

  const loadGroupMessages = async (groupId: string) => {
    const cached = groupMsgCache.current.get(groupId);
    if (cached) setGroupMessages(cached);
    try {
      const { data } = await api.get(`/messages/group/${groupId}`);
      const msgs = data.data || data;
      groupMsgCache.current.set(groupId, msgs);
      setGroupMessages(msgs);
    } catch (err) {
      // silent;
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
      // silent;
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      currentGroupIdRef.current = selectedGroup.id;
      loadGroupMessages(selectedGroup.id);
      // Reset unread counter for this group conversation
      setUnifiedConversations((prev) =>
        prev.map((c) => c.id === `group-${selectedGroup.id}` ? { ...c, unread: 0 } : c),
      );
    }
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
      // silent;
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!highlightPostId || posts.length === 0) return;
    const el = document.getElementById(`post-${highlightPostId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      const timer = setTimeout(() => setHighlightPostId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightPostId, posts]);

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
      // silent;
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const submitPost = async (force = false) => {
    if (!newPost.trim() && postImages.length === 0) return;
    if (!force && checkWarn(newPost)) {
      setWarnPending('post');
      return;
    }
    try {
      const { data } = await api.post('/posts', { content: newPost, images: postImages });
      setPosts((prev) => [data, ...prev]);
      setNewPost('');
      setPostImages([]);
    } catch (err: any) {
      if (err.response?.data?.code === 'CONTENT_BLOCKED') {
        setBlockedToast(true);
        setTimeout(() => setBlockedToast(false), 4000);
      } else {
        // silent;
      }
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
      // silent;
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
      // silent;
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async (force = false) => {
    if (!newComment.trim() || !commentPost || commentSending) return;
    if (!force && checkWarn(newComment)) {
      setWarnPending('comment');
      return;
    }
    setCommentSending(true);
    try {
      const { data } = await api.post(`/posts/${commentPost.id}/comments`, { content: newComment });
      setComments((prev) => [...prev, data]);
      setNewComment('');
      setPosts((prev) => prev.map((p) =>
        p.id === commentPost.id ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p
      ));
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      if (err.response?.data?.code === 'CONTENT_BLOCKED') {
        setBlockedToast(true);
        setTimeout(() => setBlockedToast(false), 4000);
      } else {
        // silent;
      }
    } finally {
      setCommentSending(false);
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    try {
      await api.post('/friends/request', { toUserId });
      setConnectionStatuses(prev => ({
        ...prev,
        [toUserId]: { status: 'PENDING', requestId: null, direction: 'sent' },
      }));
    } catch (err) {
      // silent;
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'post') {
        await api.delete(`/posts/${deleteConfirm.postId}`);
        setPosts((prev) => prev.filter((p) => p.id !== deleteConfirm.postId));
        if (commentPost?.id === deleteConfirm.postId) setCommentPost(null);
      } else {
        await api.delete(`/posts/${deleteConfirm.postId}/comments/${deleteConfirm.commentId}`);
        setComments((prev) => prev.filter((c) => c.id !== deleteConfirm.commentId));
        setPosts((prev) => prev.map((p) =>
          p.id === deleteConfirm.postId ? { ...p, _count: { ...p._count, comments: p._count.comments - 1 } } : p
        ));
      }
    } catch (err) {
      // silent;
    } finally {
      setDeleteConfirm(null);
    }
  };

  const submitReport = async () => {
    if (!reportReason || !reportModal || reportSending) return;
    setReportSending(true);
    try {
      if (reportModal.type === 'post') {
        await api.post(`/posts/${reportModal.id}/report`, { reason: reportReason });
      } else {
        await api.post(`/posts/${reportModal.postId}/comments/${reportModal.id}/report`, { reason: reportReason });
      }
      setReportedItems(prev => new Set([...prev, reportModal.id]));
      setReportSuccess(true);
      setTimeout(() => {
        setReportModal(null);
        setReportReason('');
        setReportSuccess(false);
      }, 2000);
    } catch (err: any) {
      // silent;
      setReportModal(null);
      setReportReason('');
    } finally {
      setReportSending(false);
    }
  };


  const CLUSTER_TAGS = ['Analista', 'Creativo', 'Leader', 'Imprenditore', 'Sociale', 'Explorer'];

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const { data } = await api.get('/profile/suggestions');
      setSuggestedProfiles(data);
      const ids = data.map((u: { id: string }) => u.id);
      if (ids.length > 0) {
        const { data: statuses } = await api.post('/friends/status/batch', { userIds: ids });
        setConnectionStatuses(prev => ({ ...prev, ...statuses }));
      }
    } catch (err) {
      // silent;
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const hasProfileFilters = (clusterTag: string | null, yearOfStudy: number | null, skillArea: string | null) =>
    !!(clusterTag || yearOfStudy || skillArea);

  const runSearch = async (
    q: string,
    clusterTag: string | null,
    yearOfStudy: number | null,
    skillArea: string | null,
  ) => {
    const hasQuery = q.trim().length > 0;
    const hasFilters = hasProfileFilters(clusterTag, yearOfStudy, skillArea);
    if (!hasQuery && !hasFilters) { setSearchProfileResults([]); return; }
    setSearchLoading(true);
    try {
      const profileParams = new URLSearchParams();
      if (hasQuery) profileParams.set('q', q);
      if (clusterTag) profileParams.set('clusterTag', clusterTag);
      if (yearOfStudy) profileParams.set('yearOfStudy', String(yearOfStudy));
      if (skillArea) profileParams.set('coreSkillArea', skillArea);
      const { data } = await api.get(`/profile/search?${profileParams.toString()}`);
      setSearchProfileResults(data);
    } catch (err) {
      // silent
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const hasQuery = searchQuery.trim().length > 0;
    const hasFilters = hasProfileFilters(selectedClusterTag, profileYearFilter, coreSkillArea);
    if (!hasQuery && !hasFilters) { setSearchProfileResults([]); return; }
    searchDebounceRef.current = setTimeout(() => {
      runSearch(searchQuery, selectedClusterTag, profileYearFilter, coreSkillArea);
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    const hasQuery = searchQuery.trim().length > 0;
    const hasFilters = hasProfileFilters(selectedClusterTag, profileYearFilter, coreSkillArea);
    if (!hasQuery && !hasFilters) return;
    runSearch(searchQuery, selectedClusterTag, profileYearFilter, coreSkillArea);
  }, [selectedClusterTag, profileYearFilter, coreSkillArea]);

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
      // silent;
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
        // silent;
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

  const CARD_GRADIENTS = [
    ['#3ECFA8', '#28B891'],
    ['#E870BF', '#D450AA'],
    ['#7B6FF0', '#5F4EE0'],
    ['#F5A623', '#E8901A'],
  ];

  function clusterTagToGradient(tag?: string): [string, string] {
    const map: Record<string, [string, string]> = {
      Analista: ['#7B6FF0', '#5F4EE0'],
      Creativo: ['#F5A623', '#E8901A'],
      Leader: ['#E84040', '#C93030'],
      Imprenditore: ['#3ECFA8', '#28B891'],
      Sociale: ['#E870BF', '#D450AA'],
      Explorer: ['#3AAEE0', '#2090C8'],
    };
    return tag && map[tag] ? map[tag] : ['#7B6FF0', '#5F4EE0'];
  }

  return (
    <div className={selectedUser || selectedGroup
      ? 'fixed top-0 left-0 right-0 z-[60] overflow-hidden'
      : ''
    } style={
      selectedUser || selectedGroup
        ? { backgroundColor: '#fbf8ff', bottom: 64 }
        : { backgroundColor: '#fbf8ff', minHeight: '100vh' }
    }>

      {!selectedUser && !selectedGroup && (
        <>
          {/* ── Sticky Header ──────────────────────────────────────── */}
          <header
            className="sticky top-0 z-40 flex items-center justify-between px-4"
            style={{
              height: 64,
              backgroundColor: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              borderBottom: '1px solid rgba(172,176,206,0.2)',
            }}
          >
            <div style={{ width: 40 }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width="129" height="37" viewBox="0 0 129 37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="COhA">
                <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
                <path d="M69.5115 18.9309C69.2759 19.1653 69.0214 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
                <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
                <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
                <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0214 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
                <mask id="mask0_net" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="35" y="0" width="63" height="37">
                  <path d="M71.4712 25.1531C70.7006 23.029 70.2645 21.7405 69.7296 19.7567C69.4798 20.0067 69.2177 20.2587 68.9286 20.5282L69.9375 25.1531L71.2156 31.1483C71.7336 33.6313 72.0648 34.9232 73.1752 36.9722H79.1393C76.8634 34.9814 75.5636 33.7184 74.1976 31.1483C73.1431 29.2076 72.518 27.9747 71.8426 26.1809C71.7213 25.8588 71.5985 25.5187 71.4712 25.1531Z" fill="#615FE2"/>
                  <path d="M69.5115 18.9309C69.2759 19.1653 69.0215 19.41 68.7417 19.6718L68.9286 20.5282C69.2177 20.2587 69.4798 20.0067 69.7296 19.7567C69.659 19.4948 69.5866 19.2207 69.5115 18.9309Z" fill="#615FE2"/>
                  <path d="M71.4712 25.1531C71.5985 25.5187 71.7213 25.8588 71.8426 26.1809C72.0364 24.163 72.6335 23.7809 74.368 24.1254C76.6938 24.7753 79.4442 26.9168 85.1034 31.6622L92.2604 36.9722C94.1412 37.0883 95.0542 36.7716 96.4352 35.5163C97.2204 34.6023 97.4273 34.0246 97.6281 32.9469V27.0373C95.4037 28.3877 94.0469 28.6879 91.4935 28.6646C87.9516 28.5053 85.6712 27.6997 81.1842 25.2387C79.009 23.8835 77.7959 23.5366 75.6461 23.0976C73.1617 22.747 71.994 23.0185 71.4712 25.1531Z" fill="#615FE2"/>
                  <path d="M68.9286 20.5282L68.7417 19.6718C65.0295 22.409 62.8021 23.2432 58.691 24.0665C52.769 24.8945 49.5694 24.8594 44.2067 23.3814C39.9966 21.8445 38.3941 20.1557 35.9421 16.701V27.9206C38.7186 30.0067 40.7534 30.4547 45.0587 30.233C51.5311 29.5949 54.7311 28.7638 59.6282 26.379C63.4523 24.4414 65.5381 23.2498 68.9286 20.5282Z" fill="#615FE2"/>
                  <path d="M69.5115 18.9309C68.9802 17.0008 68.8074 15.9253 68.5743 14.1048C68.0183 10.2861 68.1597 7.99173 71.1304 5.88275C72.9099 5.11587 73.6604 5.16552 74.4532 6.31098C75.8991 8.74632 74.9366 10.9931 72.4084 15.3895C71.4843 16.7174 70.8203 17.586 69.8437 18.5944C69.737 18.7047 69.6265 18.8166 69.5115 18.9309C69.5866 19.2207 69.659 19.4948 69.7296 19.7567C70.5076 18.9782 71.1665 18.2196 72.1528 17.0167C78.562 8.58743 78.5444 5.55711 76.1573 1.25787C76.1573 1.25787 75.5609 0.31576 74.2828 0.0588259C73.0048 -0.198108 71.9375 0.420356 71.0451 1.25787C67.1847 5.69408 66.2893 8.71045 67.8075 15.3895L68.7417 19.6718C69.0215 19.41 69.2759 19.1653 69.5115 18.9309Z" fill="#615FE2"/>
                </mask>
                <g mask="url(#mask0_net)">
                  <rect x="21.1184" y="8.70459" width="46.8622" height="28.2899" fill="url(#net_g0)"/>
                  <rect x="69.215" y="18.6378" width="49.7354" height="29.6082" fill="url(#net_g1)"/>
                  <rect x="64.48" y="23.0285" width="17.4359" height="37.5037" fill="url(#net_g2)"/>
                  <rect x="65.8629" y="-9.88831" width="25.4121" height="27.3988" fill="url(#net_g3)" fillOpacity="0.75"/>
                </g>
                <path d="M38.29 30.9597C36.9907 30.9597 35.7808 30.7242 34.6601 30.2532C33.5558 29.7822 32.5894 29.1245 31.7612 28.28C30.9329 27.4354 30.2833 26.4448 29.8123 25.3079C29.3575 24.171 29.1302 22.9286 29.1302 21.5806C29.1302 20.2326 29.3575 18.9902 29.8123 17.8534C30.267 16.7003 30.9085 15.7096 31.7368 14.8813C32.5651 14.0368 33.5314 13.3872 34.6358 12.9324C35.7564 12.4614 36.9745 12.2259 38.29 12.2259C39.6055 12.2259 40.7829 12.4452 41.8223 12.8837C42.878 13.3222 43.7712 13.9069 44.5021 14.6377C45.2329 15.3685 45.7526 16.1806 46.0612 17.0738L42.7237 18.6817C42.4151 17.8046 41.8711 17.0819 41.0915 16.5135C40.3282 15.9288 39.3943 15.6365 38.29 15.6365C37.2181 15.6365 36.2761 15.8882 35.4641 16.3917C34.652 16.8952 34.0186 17.5935 33.5639 18.4868C33.1254 19.3638 32.9061 20.3951 32.9061 21.5806C32.9061 22.7662 33.1254 23.8056 33.5639 24.6989C34.0186 25.5921 34.652 26.2905 35.4641 26.7939C36.2761 27.2974 37.2181 27.5491 38.29 27.5491C39.3943 27.5491 40.3282 27.2649 41.0915 26.6965C41.8711 26.1118 42.4151 25.381 42.7237 24.504L46.0612 26.1118C45.7526 27.0051 45.2329 27.8171 44.5021 28.5479C43.7712 29.2788 42.878 29.8634 41.8223 30.3019C40.7829 30.7404 39.6055 30.9597 38.29 30.9597ZM56.9619 30.9597C55.5976 30.9597 54.3309 30.7242 53.1615 30.2532C51.9922 29.7822 50.969 29.1245 50.092 28.28C49.2312 27.4192 48.5573 26.4204 48.07 25.2835C47.5828 24.1467 47.3392 22.9124 47.3392 21.5806C47.3392 20.2489 47.5747 19.0146 48.0457 17.8777C48.5329 16.7409 49.2069 15.7502 50.0676 14.9057C50.9447 14.0611 51.9678 13.4034 53.1372 12.9324C54.3065 12.4614 55.5814 12.2259 56.9619 12.2259C58.3423 12.2259 59.6172 12.4614 60.7866 12.9324C61.9559 13.4034 62.971 14.0611 63.8317 14.9057C64.7087 15.7502 65.3827 16.7409 65.8537 17.8777C66.3409 19.0146 66.5845 20.2489 66.5845 21.5806C66.5845 22.9124 66.3409 24.1467 65.8537 25.2835C65.3665 26.4204 64.6844 27.4192 63.8074 28.28C62.9466 29.1245 61.9316 29.7822 60.7622 30.2532C59.5929 30.7242 58.3261 30.9597 56.9619 30.9597ZM56.9619 27.5491C57.7901 27.5491 58.5535 27.403 59.2518 27.1106C59.9664 26.8183 60.5917 26.4123 61.1276 25.8926C61.6636 25.3566 62.0777 24.7232 62.3701 23.9924C62.6624 23.2616 62.8086 22.4576 62.8086 21.5806C62.8086 20.7036 62.6624 19.9078 62.3701 19.1932C62.0777 18.4624 61.6636 17.829 61.1276 17.2931C60.5917 16.7571 59.9664 16.3511 59.2518 16.075C58.5535 15.7827 57.7901 15.6365 56.9619 15.6365C56.1336 15.6365 55.3621 15.7827 54.6476 16.075C53.9492 16.3511 53.332 16.7571 52.7961 17.2931C52.2602 17.829 51.846 18.4624 51.5537 19.1932C51.2613 19.9078 51.1152 20.7036 51.1152 21.5806C51.1152 22.4576 51.2613 23.2616 51.5537 23.9924C51.846 24.7232 52.2602 25.3566 52.7961 25.8926C53.332 26.4123 53.9492 26.8183 54.6476 27.1106C55.3621 27.403 56.1336 27.5491 56.9619 27.5491ZM82.3872 30.6674L88.5262 12.5183H93.5446L99.6836 30.6674H95.5666L94.3485 26.9645H87.6979L86.4798 30.6674H82.3872ZM88.7454 23.6757H93.301L90.5238 15.1006H91.547L88.7454 23.6757Z" fill="#2C3149"/>
                <defs>
                  <linearGradient id="net_g0" x1="90.8031" y1="24.4817" x2="17.1625" y2="24.4817" gradientUnits="userSpaceOnUse">
                    <stop offset="0.240385" stopColor="#615FE2" stopOpacity="0.52"/>
                    <stop offset="0.602697" stopColor="#FBF8FF"/>
                  </linearGradient>
                  <linearGradient id="net_g1" x1="143.172" y1="35.1501" x2="65.0165" y2="35.1501" gradientUnits="userSpaceOnUse">
                    <stop offset="0.649865" stopColor="#FBF8FF"/>
                    <stop offset="0.941702" stopColor="#615FE2" stopOpacity="0.52"/>
                  </linearGradient>
                  <linearGradient id="net_g2" x1="73.0335" y1="20.1116" x2="73.2974" y2="60.5316" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#615FE2" stopOpacity="0.46"/>
                    <stop offset="0.447379" stopColor="#FBF8FF" stopOpacity="0.49"/>
                  </linearGradient>
                  <linearGradient id="net_g3" x1="87.6447" y1="-10.9698" x2="66.1891" y2="12.2683" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FBF8FF"/>
                    <stop offset="0.870192" stopColor="#615FE2"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <button
              onClick={() => setShowActionMenu(true)}
              className="flex items-center justify-center rounded-full active:opacity-70 ml-auto"
              style={{ width: 40, height: 40 }}
              aria-label="Nuova chat"
            >
              <Plus size={20} strokeWidth={2} color="#2c3149" />
            </button>
          </header>
        </>
      )}

      {/* ── List view content ──────────────────────────────────────── */}
      {!selectedUser && !selectedGroup && (
        <div>

          {/* Search bar — px-16, pt-16, full width */}
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ position: 'relative' }}>
              {/* Wrapper div needed: Search component doesn't accept style prop */}
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1, display: 'flex', alignItems: 'center' }}>
                <Search size={18} color="#595e78" />
              </div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people..."
                style={{
                  width: '100%',
                  backgroundColor: '#fbf8ff',
                  border: '1px solid #e4e7ff',
                  borderRadius: 9999,
                  padding: '16px 49px',
                  fontFamily: 'var(--font-plus-jakarta)',
                  color: '#595e78',
                  fontSize: 16,
                  outline: 'none',
                  boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
                }}
              />
              {searchQuery ? (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedClusterTag(null); setProfileYearFilter(null); setCoreSkillArea(null); }}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}
                >
                  <CloseSm size={16} color="#595e78" />
                </button>
              ) : (
                <button
                  onClick={() => setShowFilterSheet(true)}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}
                >
                  <Filter size={18} color={selectedClusterTag || profileYearFilter || coreSkillArea ? '#615fe2' : '#595e78'} />
                </button>
              )}
            </div>
          </div>

          {/* Search results */}
          {(searchQuery.trim() || hasProfileFilters(selectedClusterTag, profileYearFilter, coreSkillArea)) ? (
            <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {searchLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div className="w-6 h-6 border-2 border-[#615fe2] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchProfileResults.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '32px 0', color: '#acb0ce', fontFamily: 'var(--font-plus-jakarta)', fontSize: 14 }}>
                  Nessun profilo trovato
                </p>
              ) : (
                searchProfileResults.map((u) => {
                  const cs = connectionStatuses[u.id];
                  return (
                    <button
                      key={u.id}
                      onClick={() => router.push(`/profile/${u.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left' }}
                    >
                      <div style={{ flexShrink: 0, width: 50, height: 50, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#dde1ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {u.avatar && isValidImageUrl(u.avatar)
                          ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 18, fontWeight: 700, color: '#4a4bd7' }}>{u.name[0]}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: '#2c3149', fontFamily: 'var(--font-plus-jakarta)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</p>
                        <p style={{ fontSize: 12, color: '#595e78', fontFamily: 'var(--font-plus-jakarta)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.university?.name}{u.courseOfStudy ? ` · ${u.courseOfStudy}` : ''}
                        </p>
                      </div>
                      {cs?.status === 'ACCEPTED' ? (
                        <Check size={14} strokeWidth={2.5} color="#4a4bd7" />
                      ) : cs?.status === 'PENDING' ? (
                        <span style={{ fontSize: 10, color: '#acb0ce', border: '1px solid #e4e7ff', padding: '3px 10px', borderRadius: 9999, flexShrink: 0, fontFamily: 'var(--font-plus-jakarta)' }}>Inviato</span>
                      ) : (
                        <button
                          onClick={async (e) => { e.stopPropagation(); await sendFriendRequest(u.id); }}
                          style={{ fontSize: 10, color: '#4a4bd7', border: '1px solid #4a4bd7', padding: '3px 10px', borderRadius: 9999, flexShrink: 0, fontFamily: 'var(--font-plus-jakarta)' }}
                        >
                          Connetti
                        </button>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
              {/* ── PERSONE SUGGERITE ─────────────────────────────── */}
              <div style={{ paddingTop: 16 }}>
                <p style={{ color: '#747995', fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', lineHeight: '16px', marginBottom: 10, fontFamily: 'var(--font-plus-jakarta)', textTransform: 'uppercase', paddingLeft: 16, paddingRight: 16 }}>
                  PERSONE SUGGERITE
                </p>

                {suggestionsLoading ? (
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingLeft: 16, paddingRight: 16, scrollbarWidth: 'none' }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse" style={{ flexShrink: 0, width: 152, borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
                        <div style={{ height: 120, backgroundColor: '#e4e7ff' }} />
                        <div style={{ height: 88, backgroundColor: '#f0f2ff' }} />
                      </div>
                    ))}
                  </div>
                ) : suggestedProfiles.length === 0 ? (
                  <p style={{ color: '#acb0ce', fontFamily: 'var(--font-plus-jakarta)', fontSize: 13 }}>
                    Nessun profilo suggerito al momento
                  </p>
                ) : (
                  <div className="scrollbar-hide" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingLeft: 16, paddingRight: 16 }}>
                    {(() => {
                      const CARD_COLORS = ['#4A4BD7', '#9B2FB5', '#0E7EA0', '#C2484B', '#1A6B52', '#B45309'];
                      const swirlPath = 'M0 65.3278C2.93232 70.639 4.08249 72.1671 7.95336 75.6846C7.95336 75.6846 11.952 78.6058 17.55 81.7925C23.1481 84.9792 24.481 85.5104 30.3456 87.1037C36.2103 88.6971 38.6094 89.2282 43.6744 89.4938C43.6744 89.4938 49.539 90.0249 57.5362 89.7593C65.5335 89.4938 70.6129 88.4438 78.329 86.3071C86.0452 84.1703 87.7836 83.6199 92.4575 81.527C97.1314 79.434 99.4416 77.8503 102.854 74.0913L99.655 59.751C98.2505 51.6744 98.2357 47.0641 98.8553 38.7718C100.739 30.1714 102.9 25.4931 109.785 17.527C116.982 11.1536 125.246 12.4813 128.445 22.5726C130.578 32.9295 130.255 38.1477 124.713 48.8631C118.711 59.5743 114.63 65.2704 106.053 74.8879C107.536 81.6148 108.987 85.3667 111.384 91.3527C111.989 88.8743 112.362 87.7028 115.116 86.0415C118.438 84.9378 120.203 84.4148 124.18 84.7137C129.511 85.7759 133.018 87.344 138.042 89.7593C146.17 94.4331 150.906 96.6237 159.634 99.8506C165.914 102.112 169.479 102.555 175.895 102.241C182.736 102.173 186.902 101.196 192.956 97.4606V115.784C192.472 118.684 191.817 120.26 189.757 122.954C186.98 126.002 184.978 127.157 180.427 128H176.429C176.429 128 163.513 119.831 156.169 113.394L140.708 100.913C133.955 95.6414 130.746 93.0526 123.114 89.2282C120.222 88.0439 116.982 86.8382 114.85 88.166C112.717 90.2905 112.349 91.3326 112.451 94.2739C115.576 103.166 117.999 107.37 123.114 115.519C126.579 120.895 129.73 123.903 135.109 128H125.779H116.449C113.396 120.96 111.77 116.541 109.785 108.88L103.387 76.7469C97.7311 81.557 93.911 84.2918 87.126 88.4315C79.1924 92.8774 74.4868 95.1096 65.5335 98.5228C56.9567 101.963 51.7008 103.243 42.0749 105.162C32.2476 107.288 27.0093 107.649 18.0832 107.021C9.98818 106.033 6.65094 104.343 0 99.8506V82.5892V65.3278ZM101.788 48.8631C101.434 57.9505 102.102 63.013 105.253 71.9668C111.588 65.2882 114.585 61.156 118.582 52.8465C121.963 46.7035 122.58 43.5519 122.047 36.9129C120.181 30.805 117.98 28.771 109.785 31.8672C104.832 34.6902 102.841 37.9099 101.788 48.8631Z';
                      return suggestedProfiles.slice(0, 6).map((person, idx) => {
                        const cardColor = CARD_COLORS[idx % CARD_COLORS.length];
                        return (
                          <button
                            key={person.id}
                            onClick={() => router.push(`/profile/${person.id}`)}
                            style={{
                              flexShrink: 0,
                              width: 152,
                              position: 'relative',
                              textAlign: 'left',
                              borderRadius: 20,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                              overflow: 'hidden',
                              isolation: 'isolate',
                              border: 'none',
                              cursor: 'pointer',
                              background: 'none',
                              padding: 0,
                            }}
                          >
                            {/* Colored top section */}
                            <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
                              <svg viewBox="0 0 193 128" width="100%" height="100%" style={{ position: 'absolute', inset: 0, display: 'block' }} preserveAspectRatio="xMidYMid slice">
                                <rect width="193" height="128" fill={cardColor} />
                                <path fillRule="evenodd" clipRule="evenodd" d={swirlPath} fill="white" fillOpacity="0.18" />
                              </svg>
                            </div>

                            {/* White bottom section */}
                            <div style={{ backgroundColor: 'white', paddingTop: 42, paddingBottom: 14, paddingLeft: 12, paddingRight: 12 }}>
                            {/* Avatar — on the card wrapper, spanning the colored/white boundary */}
                            <div style={{
                              position: 'absolute',
                              top: 88,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 64,
                              height: 64,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '3px solid white',
                              zIndex: 3,
                            }}>
                              {person.avatar && isValidImageUrl(person.avatar) ? (
                                <img src={person.avatar} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', backgroundColor: '#dde1ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 22, fontWeight: 700, color: '#4a4bd7' }}>{person.name[0]}</span>
                                </div>
                              )}
                            </div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#2c3149', lineHeight: '20px', fontFamily: 'var(--font-plus-jakarta)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', margin: 0 }}>
                                {person.name}
                              </p>
                              <p style={{ fontSize: 11, color: '#595e78', lineHeight: '16px', marginTop: 3, fontFamily: 'var(--font-plus-jakarta)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {person.university?.name}
                              </p>
                              <p style={{ fontSize: 10, color: '#747995', lineHeight: '14px', marginTop: 2, fontFamily: 'var(--font-plus-jakarta)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {person.courseOfStudy}
                              </p>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* ── CHAT ──────────────────────────────────────────── */}
              <div style={{ padding: '16px 16px 0' }}>
                <p style={{ color: '#747995', fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', lineHeight: '16px', marginBottom: 12, fontFamily: 'var(--font-plus-jakarta)', textTransform: 'uppercase' }}>
                  CHAT
                </p>

                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderRadius: 24, backgroundColor: 'white' }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: '#e4e7ff', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 14, borderRadius: 9999, width: '45%', backgroundColor: '#e4e7ff', marginBottom: 8 }} />
                          <div style={{ height: 12, borderRadius: 9999, width: '70%', backgroundColor: '#e4e7ff' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : unifiedConversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: 14, color: '#acb0ce', fontFamily: 'var(--font-plus-jakarta)' }}>Nessun messaggio ancora</p>
                    <p style={{ fontSize: 12, color: '#acb0ce', fontFamily: 'var(--font-plus-jakarta)', marginTop: 4 }}>Connettiti con altri studenti per iniziare</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {unifiedConversations.map((conv) => {
                      const timeStr = conv.lastMessageAt
                        ? (() => {
                            const d = new Date(conv.lastMessageAt);
                            const now = new Date();
                            const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
                            if (diffDays === 0) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                            if (diffDays === 1) return 'Ieri';
                            const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
                            return days[d.getDay()];
                          })()
                        : '';
                      const isUnread = conv.unread > 0;
                      const isGroup = conv.type === 'group';
                      return (
                        <button
                          key={conv.id}
                          onClick={() => handleConversationClick(conv)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 12,
                            backgroundColor: 'white',
                            borderRadius: 24,
                            boxShadow: isUnread
                              ? '0px 1px 2.4px 0px rgba(0,0,0,0.05)'
                              : '0px 1px 1px rgba(0,0,0,0.05)',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          {/* Avatar */}
                          {isGroup && !conv.avatar ? (
                            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#dde1ff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <span style={{ fontWeight: 700, fontSize: 16, color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>{conv.name?.[0] ?? 'G'}</span>
                            </div>
                          ) : (
                            <div style={{ width: 50, height: 50, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: '#dde1ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {conv.avatar && isValidImageUrl(conv.avatar) ? (
                                <img src={conv.avatar} alt={conv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : conv.name ? (
                                <span style={{ fontWeight: 700, fontSize: 16, color: '#595e78', fontFamily: 'var(--font-plus-jakarta)' }}>{conv.name[0]}</span>
                              ) : (
                                <UserIcon size={22} color="#acb0ce" strokeWidth={1.5} />
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {/* Name row — time inside only for READ items */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
                              <p style={{ fontWeight: 600, fontSize: 14, color: '#2c3149', fontFamily: 'var(--font-plus-jakarta)', lineHeight: '20px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: isUnread ? '100%' : 'calc(100% - 40px)' }}>
                                {conv.name || 'Utente eliminato'}
                              </p>
                              {!isUnread && timeStr && (
                                <span style={{ fontWeight: 400, fontSize: 10, color: '#acb0ce', fontFamily: 'var(--font-plus-jakarta)', lineHeight: '15px', flexShrink: 0, marginLeft: 8 }}>
                                  {timeStr}
                                </span>
                              )}
                            </div>
                            {/* Message */}
                            <p style={{ fontSize: 12, color: isUnread ? '#595e78' : '#747995', fontFamily: 'var(--font-plus-jakarta)', fontWeight: isUnread ? 500 : 400, lineHeight: '16px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {conv.lastMessage}
                            </p>
                          </div>

                          {/* Unread: time + dot OUTSIDE content column */}
                          {isUnread && timeStr && (
                            <span style={{ fontWeight: 500, fontSize: 10, color: '#4a4bd7', fontFamily: 'var(--font-plus-jakarta)', lineHeight: '15px', flexShrink: 0 }}>
                              {timeStr}
                            </span>
                          )}
                          {isUnread && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4a4bd7', flexShrink: 0 }} />
                          )}
                        </button>
                      );
                    })}
                    {convPage < convTotalPages && (
                      <button
                        onClick={loadMoreConversations}
                        disabled={loadingMoreConv}
                        style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 500, color: '#4a4bd7', fontFamily: 'var(--font-plus-jakarta)', opacity: loadingMoreConv ? 0.5 : 1 }}
                      >
                        {loadingMoreConv ? t.common.loading : t.notifications.loadMore}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* Direct Chat View */}
      {tab === 'messaggi' && selectedUser && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#fbf8ff' }}>
          <ChatHeader
            type="individual"
            user={{ id: selectedUser.id, name: selectedUser.name, avatar: selectedUser.avatar, university: selectedUser.university }}
            onBack={() => { setSelectedUser(null); loadConversations(); }}
            onPress={() => router.push(`/profile/${selectedUser.id}`)}
          />
          <div className="max-w-lg mx-auto w-full" style={{ height: '100%', display: 'grid', gridTemplateRows: '1fr auto', overflow: 'hidden', position: 'relative' }}>

          {/* Watermark logo */}
          <svg
            aria-hidden
            width="390"
            height="700"
            viewBox="0 0 390 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: 'auto',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 0,
            }}
          >
            <path fillRule="evenodd" clipRule="evenodd" d="M-394 327.67C-378.712 361.342 -372.715 371.03 -352.534 393.33C-352.534 393.33 -331.687 411.85 -302.501 432.053C-273.315 452.256 -266.365 455.624 -235.789 465.725C-205.213 475.827 -192.705 479.194 -166.299 480.878C-166.299 480.878 -135.723 484.245 -94.028 482.561C-52.3334 480.878 -25.8512 474.221 14.3779 460.675C54.607 447.128 63.6704 443.638 88.0383 430.37C112.406 417.101 124.451 407.06 142.241 383.229L125.563 292.314C118.241 241.11 118.164 211.881 121.394 159.31C131.212 104.785 142.479 75.1256 178.377 24.622C215.902 -15.7844 258.986 -7.3664 275.664 56.6103C286.782 122.271 285.1 155.354 256.206 223.287C224.915 291.194 203.636 327.306 158.919 388.28C166.654 430.927 174.216 454.713 186.715 492.663C189.866 476.95 191.813 469.523 206.173 458.991C223.493 451.994 232.693 448.678 253.427 450.573C281.223 457.307 299.506 467.249 325.697 482.561C368.077 512.192 392.769 526.08 438.273 546.538C471.013 560.873 489.599 563.683 523.052 561.691C558.714 561.264 580.437 555.065 612 531.386V647.554C609.476 665.938 606.063 675.932 595.322 693.012C580.842 712.331 570.406 719.654 546.679 725H525.831C525.831 725 458.494 673.207 420.205 632.402L339.596 553.273C304.39 519.853 287.66 503.44 247.867 479.194C232.791 471.686 215.902 464.042 204.783 472.46C193.664 485.929 191.747 492.535 192.275 511.183C208.568 567.557 221.203 594.21 247.867 645.871C265.936 679.955 282.362 699.025 310.409 725H261.766H213.122C197.205 680.368 188.727 652.354 178.377 603.781L145.021 400.065C115.533 430.56 95.6165 447.898 60.2419 474.143C18.8789 502.329 -5.6539 516.481 -52.3334 538.12C-97.0493 559.928 -124.452 568.044 -174.637 580.21C-225.873 593.69 -253.184 595.976 -299.721 591.995C-341.925 585.733 -359.325 575.019 -394 546.538V437.104V327.67ZM136.682 223.287C134.839 280.9 138.323 312.994 154.75 369.76C187.778 327.419 203.405 301.222 224.241 248.541C241.867 209.596 245.088 189.615 242.308 147.525C232.579 108.802 221.101 95.9066 178.377 115.536C152.556 133.434 142.173 153.846 136.682 223.287Z" fill="#ECEDFF" fillOpacity="0.59"/>
          </svg>

          {/* Messages scroll area */}
          <div
            className="scrollbar-hide"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingTop: 80,
              paddingBottom: 80,
              paddingLeft: 16,
              paddingRight: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: 16,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(74,75,215,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <ChatDots size={28} color="#4a4bd7" />
                </div>
                <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontSize: 14, color: '#595e78' }}>
                  {selectedUser.name
                    ? <>Inizia una conversazione con <span style={{ color: '#2c3149', fontWeight: 600 }}>{selectedUser.name}</span></>
                    : 'Questo account è stato eliminato'}
                </p>
              </div>
            )}

            {/* Group messages by date */}
            {messages.map((msg, idx) => {
              const msgDate = new Date(msg.sentAt);
              const prevMsg = messages[idx - 1];
              const prevDate = prevMsg ? new Date(prevMsg.sentAt) : null;
              const showTimestamp = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
              const isMine = msg.senderId === user?.id;

              return (
                <div key={msg.id}>
                  {showTimestamp && (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 8 }}>
                      <div style={{
                        backgroundColor: '#f3f2ff',
                        borderRadius: 9999,
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 4,
                        paddingBottom: 4,
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-plus-jakarta)',
                          fontWeight: 500,
                          fontSize: 12,
                          lineHeight: '16px',
                          color: '#595e78',
                        }}>
                          {msgDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    {msg.type === 'OPPORTUNITY' && msg.opportunityId ? (
                      <OpportunityMessageCard opportunityId={msg.opportunityId} isMine={isMine} />
                    ) : (
                      <div style={{
                        maxWidth: '75%',
                        backgroundColor: isMine ? '#4a4bd7' : '#e4e7ff',
                        borderRadius: 24,
                        paddingLeft: 16,
                        paddingRight: 16,
                        paddingTop: msg.images && msg.images.length > 0 ? 6 : 12,
                        paddingBottom: msg.images && msg.images.length > 0 ? 6 : 12,
                        boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                      }}>
                        {msg.images && msg.images.length > 0 && (
                          <div style={{ display: msg.images.length === 1 ? 'block' : 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: msg.content ? 6 : 0 }}>
                            {msg.images.map((img, i) => (
                              <button
                                key={i}
                                onClick={() => setLightbox({ images: msg.images!, index: i })}
                                style={{ display: 'block', overflow: 'hidden', borderRadius: 16, gridColumn: msg.images!.length % 2 !== 0 && i === msg.images!.length - 1 ? 'span 2' : undefined }}
                              >
                                <img src={img} alt="" style={{ width: '100%', objectFit: 'cover', maxHeight: msg.images!.length === 1 ? 256 : 128, borderRadius: 16 }} />
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.content && (
                          <p style={{
                            fontFamily: 'var(--font-plus-jakarta)',
                            fontWeight: 400,
                            fontSize: 14,
                            lineHeight: '20px',
                            color: isMine ? '#fbf7ff' : '#000000',
                            margin: 0,
                          }}>
                            {msg.content}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 65, backgroundColor: '#fbf8ff' }}>
          <div style={{ maxWidth: 512, margin: '0 auto', padding: '8px 16px 12px' }}>
            {chatImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }} className="scrollbar-hide">
                {chatImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={img} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                    <button
                      onClick={() => removeChatImage(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
                    >
                      <CloseSm size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {selectedUser?.canMessage === false || !selectedUser?.name ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0', fontFamily: 'var(--font-plus-jakarta)', fontSize: 13, color: '#595e78', fontStyle: 'italic' }}>
                {!selectedUser?.name ? 'Questo account è stato eliminato' : 'Questo utente non accetta messaggi'}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'white',
                border: '1px solid rgba(172,176,206,0.3)',
                borderRadius: 24,
                boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                paddingLeft: 17,
                paddingRight: 5,
                paddingTop: 5,
                paddingBottom: 5,
              }}>
                <button
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={chatImages.length >= 5}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 9999, flexShrink: 0, opacity: chatImages.length >= 5 ? 0.4 : 1 }}
                >
                  <Plus size={20} strokeWidth={2} color="#595e78" />
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
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontFamily: 'var(--font-plus-jakarta)',
                    fontWeight: 400,
                    fontSize: 14,
                    color: '#2c3149',
                    padding: '9px 8px',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() && chatImages.length === 0}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    backgroundColor: '#4a4bd7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                    opacity: !newMessage.trim() && chatImages.length === 0 ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <PaperPlane size={16} strokeWidth={1.5} color="white" />
                </button>
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      )}

      {/* Group Chat View */}
      {tab === 'messaggi' && selectedGroup && !selectedUser && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#fbf8ff' }}>
          <ChatHeader
            type="group"
            group={{ id: selectedGroup.id, name: selectedGroup.name, image: selectedGroup.image }}
            onBack={() => { setSelectedGroup(null); loadConversations(); }}
            onPress={openGroupOptions}
          />
          <div className="max-w-lg mx-auto w-full" style={{ height: '100%', display: 'grid', gridTemplateRows: '1fr auto', overflow: 'hidden', position: 'relative' }}>

          {/* Watermark logo */}
          <svg
            aria-hidden
            width="390"
            height="700"
            viewBox="0 0 390 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: 'auto',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 0,
            }}
          >
            <path fillRule="evenodd" clipRule="evenodd" d="M-394 327.67C-378.712 361.342 -372.715 371.03 -352.534 393.33C-352.534 393.33 -331.687 411.85 -302.501 432.053C-273.315 452.256 -266.365 455.624 -235.789 465.725C-205.213 475.827 -192.705 479.194 -166.299 480.878C-166.299 480.878 -135.723 484.245 -94.028 482.561C-52.3334 480.878 -25.8512 474.221 14.3779 460.675C54.607 447.128 63.6704 443.638 88.0383 430.37C112.406 417.101 124.451 407.06 142.241 383.229L125.563 292.314C118.241 241.11 118.164 211.881 121.394 159.31C131.212 104.785 142.479 75.1256 178.377 24.622C215.902 -15.7844 258.986 -7.3664 275.664 56.6103C286.782 122.271 285.1 155.354 256.206 223.287C224.915 291.194 203.636 327.306 158.919 388.28C166.654 430.927 174.216 454.713 186.715 492.663C189.866 476.95 191.813 469.523 206.173 458.991C223.493 451.994 232.693 448.678 253.427 450.573C281.223 457.307 299.506 467.249 325.697 482.561C368.077 512.192 392.769 526.08 438.273 546.538C471.013 560.873 489.599 563.683 523.052 561.691C558.714 561.264 580.437 555.065 612 531.386V647.554C609.476 665.938 606.063 675.932 595.322 693.012C580.842 712.331 570.406 719.654 546.679 725H525.831C525.831 725 458.494 673.207 420.205 632.402L339.596 553.273C304.39 519.853 287.66 503.44 247.867 479.194C232.791 471.686 215.902 464.042 204.783 472.46C193.664 485.929 191.747 492.535 192.275 511.183C208.568 567.557 221.203 594.21 247.867 645.871C265.936 679.955 282.362 699.025 310.409 725H261.766H213.122C197.205 680.368 188.727 652.354 178.377 603.781L145.021 400.065C115.533 430.56 95.6165 447.898 60.2419 474.143C18.8789 502.329 -5.6539 516.481 -52.3334 538.12C-97.0493 559.928 -124.452 568.044 -174.637 580.21C-225.873 593.69 -253.184 595.976 -299.721 591.995C-341.925 585.733 -359.325 575.019 -394 546.538V437.104V327.67ZM136.682 223.287C134.839 280.9 138.323 312.994 154.75 369.76C187.778 327.419 203.405 301.222 224.241 248.541C241.867 209.596 245.088 189.615 242.308 147.525C232.579 108.802 221.101 95.9066 178.377 115.536C152.556 133.434 142.173 153.846 136.682 223.287Z" fill="#ECEDFF" fillOpacity="0.59"/>
          </svg>

          {/* Messages scroll area */}
          <div
            className="scrollbar-hide"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingTop: 80,
              paddingBottom: 80,
              paddingLeft: 16,
              paddingRight: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: 16,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {groupMessages.map((msg, idx) => {
              const msgDate = new Date(msg.sentAt);
              const prevMsg = groupMessages[idx - 1];
              const prevDate = prevMsg ? new Date(prevMsg.sentAt) : null;
              const showTimestamp = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
              const isMine = msg.senderId === user?.id;

              return (
                <div key={msg.id}>
                  {showTimestamp && (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 8 }}>
                      <div style={{ backgroundColor: '#f3f2ff', borderRadius: 9999, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: '#595e78' }}>
                          {msgDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '75%' }}>
                      {!isMine && (
                        <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontSize: 10, color: '#4a4bd7', marginBottom: 2, marginLeft: 4 }}>
                          {msg.sender?.name || 'Utente eliminato'}
                        </p>
                      )}
                      <div style={{
                        backgroundColor: isMine ? '#4a4bd7' : '#e4e7ff',
                        borderRadius: 24,
                        paddingLeft: 16,
                        paddingRight: 16,
                        paddingTop: msg.images && msg.images.length > 0 ? 6 : 12,
                        paddingBottom: msg.images && msg.images.length > 0 ? 6 : 12,
                        boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                      }}>
                        {msg.images && msg.images.length > 0 && (
                          <div style={{ display: msg.images.length === 1 ? 'block' : 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: msg.content ? 6 : 0 }}>
                            {msg.images.map((img, i) => (
                              <button
                                key={i}
                                onClick={() => setLightbox({ images: msg.images!, index: i })}
                                style={{ display: 'block', overflow: 'hidden', borderRadius: 16, gridColumn: msg.images!.length % 2 !== 0 && i === msg.images!.length - 1 ? 'span 2' : undefined }}
                              >
                                <img src={img} alt="" style={{ width: '100%', objectFit: 'cover', maxHeight: msg.images!.length === 1 ? 256 : 128, borderRadius: 16 }} />
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.content && (
                          <p style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: isMine ? '#fbf7ff' : '#000000', margin: 0 }}>
                            {msg.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 65, backgroundColor: '#fbf8ff' }}>
          <div style={{ maxWidth: 512, margin: '0 auto', padding: '8px 16px 12px' }}>
            {chatImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }} className="scrollbar-hide">
                {chatImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={img} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                    <button
                      onClick={() => removeChatImage(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
                    >
                      <CloseSm size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'white',
              border: '1px solid rgba(172,176,206,0.3)',
              borderRadius: 24,
              boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
              paddingLeft: 17,
              paddingRight: 5,
              paddingTop: 5,
              paddingBottom: 5,
            }}>
              <button
                onClick={() => chatFileInputRef.current?.click()}
                disabled={chatImages.length >= 5}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 9999, flexShrink: 0, opacity: chatImages.length >= 5 ? 0.4 : 1 }}
              >
                <Plus size={20} strokeWidth={2} color="#595e78" />
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
                placeholder="Scrivi un messaggio..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-plus-jakarta)',
                  fontWeight: 400,
                  fontSize: 14,
                  color: '#2c3149',
                  padding: '9px 8px',
                }}
              />
              <button
                onClick={sendGroupMessage}
                disabled={!newMessage.trim() && chatImages.length === 0}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  backgroundColor: '#4a4bd7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
                  opacity: !newMessage.trim() && chatImages.length === 0 ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <PaperPlane size={16} strokeWidth={1.5} color="white" />
              </button>
            </div>
          </div>
          </div>
          </div>
        </div>
      )}

      {/* Explore Tab - Social Feed */}
      {tab === 'esplora' && (
        <div className="space-y-4">

          {/* Search bar */}
          <div className="relative">
            <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.networking.searchPlaceholder}
              className="w-full bg-[#161B22] rounded-xl pl-9 pr-12 py-3 text-white placeholder-gray-500 text-sm outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedClusterTag(null); setProfileYearFilter(null); setCoreSkillArea(null); }}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-500 active:opacity-70 w-6 h-6 flex items-center justify-center"
              >
                <CloseSm size={14} />
              </button>
            )}
            <button
              onClick={() => setShowFilterSheet(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg"
            >
              <Filter size={20} strokeWidth={2} className={`transition-colors ${(selectedClusterTag || profileYearFilter || coreSkillArea) ? 'text-primary' : 'text-gray-400'}`} />
              {(selectedClusterTag || profileYearFilter || coreSkillArea) && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary pointer-events-none" />
              )}
            </button>
          </div>

          {/* Search results: profiles only */}
          {(searchQuery.trim() || hasProfileFilters(selectedClusterTag, profileYearFilter, coreSkillArea)) && (
            <>
              <p className="text-xs text-gray-500 font-medium">
                {t.networking.searchProfiles}
                {!searchLoading && <span className="ml-1.5 text-gray-600">({searchProfileResults.length})</span>}
              </p>
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchProfileResults.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">{t.networking.noProfilesFound}</div>
              ) : (
                <div className="space-y-3">
                  {searchProfileResults.map((u) => {
                    const cs = connectionStatuses[u.id];
                    return (
                      <div key={u.id} className="bg-[#1a1b2e] rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                        <button onClick={() => router.push(`/profile/${u.id}`)} className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0 overflow-hidden">
                          {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : <span className="text-white text-lg font-medium">{u.name[0]}</span>}
                        </button>
                        <button className="flex-1 min-w-0 text-left" onClick={() => router.push(`/profile/${u.id}`)}>
                          <p className="text-white font-medium text-sm truncate">{u.name}</p>
                          <p className="text-gray-400 text-xs truncate">{u.university?.shortName || u.university?.name}{u.courseOfStudy && ` · ${u.courseOfStudy}`}</p>
                          {u.profile?.clusterTag && (
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">{u.profile.clusterTag}</span>
                          )}
                        </button>
                        {cs?.status === 'ACCEPTED' ? (
                          <span className="text-xs text-green-400 border border-green-400/30 px-3 py-1 rounded-full flex items-center gap-1 shrink-0"><Check size={12} strokeWidth={2.5} />{t.userProfile.connected}</span>
                        ) : cs?.status === 'PENDING' ? (
                          <span className="text-xs text-gray-500 border border-gray-600 px-3 py-1 rounded-full shrink-0">{t.userProfile.requestSent}</span>
                        ) : (
                          <button
                            onClick={async () => {
                              await sendFriendRequest(u.id);
                              const { data: statuses } = await api.post('/friends/status/batch', { userIds: [u.id] });
                              setConnectionStatuses(prev => ({ ...prev, ...statuses }));
                            }}
                            className="text-xs text-primary border border-primary/30 px-3 py-1 rounded-full hover:bg-primary/10 transition-colors shrink-0"
                          >
                            {t.userProfile.connect}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Normal feed (hidden when searching) */}
          {!searchQuery.trim() && !hasProfileFilters(selectedClusterTag, profileYearFilter, coreSkillArea) && (
          <>
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
                onClick={() => submitPost()}
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
              <div key={post.id} id={`post-${post.id}`} className={`card${post.author?.id === user?.id ? ' border-l-2 border-l-primary/60' : ''}${highlightPostId === post.id ? ' ring-2 ring-primary/60' : ''}`}>
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
                      <div className="flex items-center gap-1.5">
                        <p className={`font-medium text-sm ${post.author?.id && post.author.id !== user?.id ? 'hover:underline text-text-primary' : 'text-text-primary'} ${!post.author?.name ? 'text-[#64748B] italic' : ''}`}>
                          {post.author?.name || 'Utente eliminato'}
                        </p>
                        {post.author?.id === user?.id && (
                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium leading-none">Tu</span>
                        )}
                      </div>
                      {post.author?.name && (
                        <p className="text-[10px] text-text-muted">
                          {post.author.university?.name} {post.author.courseOfStudy && `· ${post.author.courseOfStudy}`}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
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
                    {post.author?.id && (post.author.id === user?.id || !reportedItems.has(post.id)) && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenPostMenu(openPostMenu === post.id ? null : post.id)}
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {openPostMenu === post.id && (
                          <div className="absolute right-0 top-full mt-1 bg-card border border-white/10 rounded-xl shadow-lg py-1 z-10 min-w-[140px]">
                            {post.author.id === user?.id ? (
                              <button
                                onClick={() => { setDeleteConfirm({ type: 'post', postId: post.id }); setOpenPostMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                              >
                                <Trash size={14} color="currentColor" />
                                Elimina post
                              </button>
                            ) : (
                              <button
                                onClick={() => { setReportModal({ type: 'post', id: post.id }); setOpenPostMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                              >
                                <Flag size={14} color="currentColor" />
                                Segnala post
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {post.author?.id && post.author.id !== user?.id && reportedItems.has(post.id) && (
                      <span className="text-[10px] text-gray-500 italic">Segnalato</span>
                    )}
                  </div>
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
              {loadingMorePosts ? t.common.loading : t.notifications.loadMore}
            </button>
          )}
          </>
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
                  <div key={c.id} className="flex gap-3 group">
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => c.author?.id && c.author.id !== user?.id && router.push(`/profile/${c.author.id}`)}
                          className={`text-sm font-semibold ${c.author?.name ? 'text-white hover:underline' : 'text-[#64748B] italic'}`}
                        >
                          {c.author?.name || 'Utente eliminato'}
                        </button>
                        <span className="text-gray-500 text-xs">
                          {new Date(c.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        </span>
                        {/* Delete: comment author or post owner */}
                        {(c.author?.id === user?.id || commentPost?.author?.id === user?.id) && (
                          <button
                            onClick={() => setDeleteConfirm({ type: 'comment', postId: commentPost!.id, commentId: c.id })}
                            className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 text-gray-600 hover:text-red-400 transition-all"
                            title="Elimina commento"
                          >
                            <Trash size={12} color="currentColor" />
                          </button>
                        )}
                        {/* Report: only for non-own comments when user is not post owner */}
                        {c.author?.id && c.author.id !== user?.id && commentPost?.author?.id !== user?.id && !reportedItems.has(c.id) && (
                          <button
                            onClick={() => setReportModal({ type: 'comment', id: c.id, postId: commentPost!.id })}
                            className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 text-gray-600 hover:text-red-400 transition-all"
                            title="Segnala commento"
                          >
                            <Flag size={12} color="currentColor" />
                          </button>
                        )}
                        {reportedItems.has(c.id) && (
                          <span className="text-[10px] text-gray-600 italic ml-auto">Segnalato</span>
                        )}
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
                onClick={() => submitComment()}
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

      {/* Overlay to close post context menu */}
      {openPostMenu && (
        <div className="fixed inset-0 z-[5]" onClick={() => setOpenPostMenu(null)} />
      )}

      {/* Search Filter Modal */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${showFilterSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: 'rgba(44,49,73,0.4)' }}
        onClick={() => setShowFilterSheet(false)}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-none">
        <div
          className={`w-full max-w-lg rounded-3xl transition-all duration-300 ease-out ${showFilterSheet ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
          style={{ backgroundColor: 'white', boxShadow: '0 8px 40px rgba(74,75,215,0.15)' }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <h2 className="font-bold text-lg" style={{ color: '#2c3149' }}>Filtri</h2>
            <button
              onClick={() => { setSelectedClusterTag(null); setProfileYearFilter(null); setCoreSkillArea(null); }}
              className="text-sm font-semibold active:opacity-70 transition-opacity"
              style={{ color: '#4a4bd7' }}
            >
              Reset
            </button>
          </div>

          <div className="px-5 pb-4 space-y-6 max-h-[68vh] overflow-y-auto no-scrollbar">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#acb0ce' }}>Cluster</p>
              <div className="flex flex-wrap gap-2">
                {CLUSTER_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedClusterTag(selectedClusterTag === tag ? null : tag)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75 whitespace-nowrap"
                    style={{ backgroundColor: selectedClusterTag === tag ? '#4a4bd7' : '#f0f1f8', color: selectedClusterTag === tag ? 'white' : '#595e78' }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#acb0ce' }}>Anno di studio</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setProfileYearFilter(profileYearFilter === yr ? null : yr)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75"
                    style={{ backgroundColor: profileYearFilter === yr ? '#4a4bd7' : '#f0f1f8', color: profileYearFilter === yr ? 'white' : '#595e78' }}
                  >
                    {yr}° anno
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px" style={{ backgroundColor: '#f3f2ff' }} />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#acb0ce' }}>Competenza core</p>
              <div className="flex flex-wrap gap-2">
                {MACRO_AREAS.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => setCoreSkillArea(coreSkillArea === area.id ? null : area.id)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:opacity-75"
                    style={{ backgroundColor: coreSkillArea === area.id ? '#4a4bd7' : '#f0f1f8', color: coreSkillArea === area.id ? 'white' : '#595e78' }}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="px-5 pt-4 pb-8" style={{ borderTop: '1px solid #f3f2ff' }}>
            <button
              onClick={() => setShowFilterSheet(false)}
              className="w-full py-4 rounded-[20px] font-semibold text-[15px] text-white active:opacity-90 transition-opacity"
              style={{ backgroundColor: '#4a4bd7' }}
            >
              Mostra risultati
            </button>
          </div>
        </div>
      </div>

      {/* Content Blocked Toast */}
      {blockedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm animate-fade-in">
          <div className="bg-[#1E1215] border border-red-500/30 rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-xl">
            <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-400 text-sm leading-none">✕</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Contenuto non pubblicabile</p>
              <p className="text-red-300/80 text-xs mt-0.5 leading-relaxed">
                Il tuo post contiene parole che violano le linee guida della community e non può essere pubblicato.
              </p>
            </div>
            <button onClick={() => setBlockedToast(false)} className="text-red-400/50 hover:text-red-400 transition-colors ml-auto shrink-0 mt-0.5">
              <CloseSm size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Warn Modal */}
      {warnPending && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-end sm:items-center justify-center" onClick={() => setWarnPending(null)}>
          <div className="bg-surface w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-yellow-400 text-lg leading-none">⚠</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-1">Linguaggio volgare rilevato</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Il tuo {warnPending === 'post' ? 'post' : 'commento'} contiene linguaggio potenzialmente inappropriato per una community universitaria. Vuoi modificarlo o pubblicarlo comunque?
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWarnPending(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                {t.common.edit}
              </button>
              <button
                onClick={() => { const t = warnPending; setWarnPending(null); t === 'post' ? submitPost(true) : submitComment(true); }}
                className="flex-1 py-2.5 rounded-xl bg-yellow-500/80 text-white text-sm font-medium hover:bg-yellow-500 transition-colors"
              >
                Pubblica comunque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-end sm:items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface w-full sm:max-w-xs sm:rounded-2xl rounded-t-2xl p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <h3 className="text-white font-semibold text-base mb-1">
              {deleteConfirm.type === 'post' ? 'Elimina post' : 'Elimina commento'}
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              {deleteConfirm.type === 'post'
                ? 'Il post verrà eliminato definitivamente. Sei sicuro?'
                : 'Il commento verrà eliminato definitivamente. Sei sicuro?'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-sm font-medium hover:bg-red-500 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-end sm:items-center justify-center" onClick={() => { setReportModal(null); setReportReason(''); }}>
          <div
            className="bg-surface w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (mobile only) */}
            <div className="flex justify-center mb-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            {reportSuccess ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} color="#4ade80" strokeWidth={2.5} />
                </div>
                <p className="text-white font-semibold">Segnalazione inviata</p>
                <p className="text-gray-400 text-sm mt-1">Grazie per aver contribuito alla sicurezza della community.</p>
              </div>
            ) : (
              <>
                <h3 className="text-white font-semibold text-lg mb-1">Segnala contenuto</h3>
                <p className="text-gray-400 text-sm mb-4">Perché vuoi segnalare questo contenuto?</p>
                <div className="space-y-2 mb-5">
                  {['Spam', 'Contenuto inappropriato', 'Molestie o bullismo', 'Disinformazione', 'Altro'].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                        reportReason === reason
                          ? 'bg-primary/20 text-primary border border-primary/40'
                          : 'bg-card text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setReportModal(null); setReportReason(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={!reportReason || reportSending}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-sm font-medium disabled:opacity-40 hover:bg-red-500 transition-colors"
                  >
                    {reportSending ? 'Invio...' : 'Segnala'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
