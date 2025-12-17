'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { ChatService } from '@/services/chat.service';
import { Chat, Message, User, WsEventType } from '@/types/chat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { jwtDecode } from 'jwt-decode';
import { FaSignOutAlt, FaTimes, FaUsers, FaBell, FaBellSlash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { MessageList } from '@/components/MessageList';

interface JwtPayload {
  sub: string;
  name: string;
  exp: number;
}

function makeTempId() {
  return `tmp-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}


function playMessageSound() {
  try {
    const a = new Audio('/sounds/message.mp3');
    a.volume = 0.6;
    a.play().catch(() => {
    });
  } catch {
  }
}

async function notifyBrowser(title: string, body: string) {
  try {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;

    new Notification(title, { body });
  } catch {
    // ignore
  }
}


export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // New conversation modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  // Group creation modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<User[]>([]);
  const [searchingGroupUsers, setSearchingGroupUsers] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [unreadByChatId, setUnreadByChatId] = useState<Record<string, number>>({});
  const [mutedByChatId, setMutedByChatId] = useState<Record<string, boolean>>({});


  // per-chat notification mute
  useEffect(() => {
    try {
      const raw = localStorage.getItem('geets.muted_chats');
      if (raw) setMutedByChatId(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('geets.muted_chats', JSON.stringify(mutedByChatId));
    } catch {
      // ignore
    }
  }, [mutedByChatId]);

  const toggleChatMuted = useCallback((chatId: string) => {
    setMutedByChatId((prev) => {
      const id = String(chatId);
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
  }, []);

  const isChatMuted = useCallback(
    (chatId: string) => {
      return Boolean(mutedByChatId[String(chatId)]);
    },
    [mutedByChatId]
  );


  const selectedChatRef = useRef<Chat | null>(null);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [router]);

  useEffect(() => {
    const token = AuthService.getToken();
    if (token) {
      const decodedToken = jwtDecode<JwtPayload>(token);
      setCurrentUserId(String(decodedToken.sub));
    }
  }, []);

  const loadingChatsRef = useRef(false);

  const loadChats = useCallback(async () => {
    if (loadingChatsRef.current) return;
    loadingChatsRef.current = true;

    try {
      const data = await ChatService.getAllChats();
      setChats(data);
    } catch (e) {
      console.error('Failed to load chats:', e);
    } finally {
      loadingChatsRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadChats();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadChats]);

  const reconcileOptimistic = useCallback(
    (serverMsg: Message) => {
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i];
          if (
            m.is_pending &&
            String(m.sender_id) === String(currentUserId) &&
            String(m.conversation_id) === String(serverMsg.conversation_id) &&
            m.body === serverMsg.body
          ) {
            const next = [...prev];
            next[i] = {
              ...serverMsg,
              is_pending: false,
              status: 'DELIVERED',
              delivered_at: serverMsg.delivered_at ?? serverMsg.created_at,
            };
            return next;
          }
        }

        return [
          ...prev,
          {
            ...serverMsg,
            is_pending: false,
            status: 'DELIVERED',
            delivered_at: serverMsg.delivered_at ?? serverMsg.created_at,
          },
        ];
      });
    },
    [currentUserId]
  );

  const applySeenUpTo = useCallback(
    (conversationId: string, lastSeenMessageId: string) => {
      setMessages((prev) => {
        const selected = selectedChatRef.current;
        if (!selected || String(selected.id) !== String(conversationId)) return prev;

        const idx = prev.findIndex((m) => m.id === lastSeenMessageId);
        if (idx === -1) return prev;

        const nowIso = new Date().toISOString();
        return prev.map((m, i) => {
          if (i <= idx && String(m.sender_id) === String(currentUserId)) {
            return { ...m, status: 'SEEN', seen_at: m.seen_at ?? nowIso };
          }
          return m;
        });
      });
    },
    [currentUserId]
  );

  const handleWs = useCallback(
    (type: WsEventType, payload: any) => {
      const selected = selectedChatRef.current;
      const selectedId = selected ? String(selected.id) : null;

      if (type === 'message.create') {
        const serverMsg: Message = {
          id: String(payload.id),
          conversation_id: String(payload.conversation_id),
          sender_id: String(payload.sender_id),
          sender_username: payload.sender_username,
          body: payload.body,
          created_at: payload.created_at ?? new Date().toISOString(),
          updated_at: payload.updated_at,
          status: payload.status,
          delivered_at: payload.delivered_at ?? null,
          seen_at: payload.seen_at ?? null,
        };

        if (selectedId && serverMsg.conversation_id === selectedId) {
          if (String(serverMsg.sender_id) === String(currentUserId)) {
            reconcileOptimistic(serverMsg);
          } else {
            setMessages((prev) => [...prev, serverMsg]);

            setUnreadByChatId((prev) => {
              const next = { ...prev };
              delete next[String(serverMsg.conversation_id)];
              return next;
            });
          }
        } else {
          // чат НЕ открыт: входящее сообщение => unread + уведомление
          if (String(serverMsg.sender_id) !== String(currentUserId)) {
            const cid = String(serverMsg.conversation_id);

            setUnreadByChatId((prev) => ({ ...prev, [cid]: (prev[cid] ?? 0) + 1 }));

            if (!isChatMuted(cid)) {
              playMessageSound();
              const chatName = 
                chats.find((c) => String(c.id) === cid)?.name ??
                chats.find((c) => String(c.id) === cid)?.title ??
                'New message';
              notifyBrowser(chatName, serverMsg.body);
            }
          }
        }

        loadChats();
        return;
      }

      if (type === 'message.edit') {
        const editedId = String(payload.message_id ?? payload.id);
        const newBody = payload.body ?? payload.new_body;
        const updatedAt = payload.updated_at ?? new Date().toISOString();

        setMessages((prev) => prev.map((m) => (m.id === editedId ? { ...m, body: newBody, updated_at: updatedAt } : m)));
        return;
      }

      if (type === 'message.delete') {
        const deletedId = String(payload.message_id ?? payload.id);
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        loadChats();
        return;
      }

      if (type === 'message.delivered') {
        const messageId = String(payload.message_id ?? payload.id);
        const deliveredAt = payload.delivered_at ?? new Date().toISOString();

        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: 'DELIVERED', delivered_at: deliveredAt, is_pending: false } : m))
        );
        return;
      }

      if (type === 'message.seen') {
        const conversationId = String(payload.conversation_id);
        const lastSeenId = String(payload.last_seen_message_id ?? payload.message_id ?? payload.id);
        applySeenUpTo(conversationId, lastSeenId);
        return;
      }
    }, [applySeenUpTo, currentUserId, loadChats, reconcileOptimistic, chats, isChatMuted]);

  const { isConnected, sendMessage: sendWsMessage, disconnect: wsDisconnect } = useWebSocket(handleWs);

  const loadMessages = async (chat: Chat) => {
    try {
      const data = await ChatService.getMessages(chat.id, chat.is_group);

      let participants: User[] | undefined = chat.participants;
      if (chat.is_group) {
        participants = await ChatService.getGroupParticipants(chat.id);
      }

      setMessages(data);
      setSelectedChat({ ...chat, participants });

      // clear unread when opening chat
      setUnreadByChatId((prev) => {
        const next = { ...prev };
        delete next[String(chat.id)];
        return next;
      });
      setEditingMessageId(null);
      setEditingText('');
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // ---- SEEN: отправка last_seen только когда веизу (через MessageList onBottomVisible) ----
  const lastSentSeenRef = useRef<Record<string, string>>({}); // conversationId -> lastSeenMessageId

  const sendSeenIfNeeded = useCallback(() => {
    if (!selectedChat) return;
    if (!currentUserId) return;

    const convId = String(selectedChat.id);

    const lastIncoming = [...messages].reverse().find((m) => String(m.sender_id) !== String(currentUserId));
    if (!lastIncoming) return;

    const lastSeenId = String(lastIncoming.id);

    if (lastSentSeenRef.current[convId] === lastSeenId) return;
    lastSentSeenRef.current[convId] = lastSeenId;

    // clear unread as soon as we consider this chat read
    setUnreadByChatId((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });

    try {
      sendWsMessage('message.seen', {
        conversation_id: convId,
        last_seen_message_id: lastSeenId,
      });
    } catch (e) {
      // ws может быть не готов — ок
      console.log('send seen skipped:', e);
    }
  }, [currentUserId, messages, selectedChat, sendWsMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sendingMessage) return;
    if (!currentUserId) return;

    setSendingMessage(true);

    const body = newMessage;
    const tempId = makeTempId();

    const optimistic: Message = {
      id: tempId,
      conversation_id: String(selectedChat.id),
      sender_id: String(currentUserId),
      body,
      created_at: new Date().toISOString(),
      is_pending: true,
      status: 'SENT',
      delivered_at: null,
      seen_at: null,
    };

    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');

    try {
      sendWsMessage('message.create', {
        conversation_id: selectedChat.id,
        body,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(body);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingText(message.body);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async () => {
    if (!editingText.trim() || !editingMessageId) return;

    try {
      sendWsMessage('message.edit', {
        id: editingMessageId,
        new_body: editingText,
      });
      setEditingMessageId(null);
      setEditingText('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return;
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      sendWsMessage('message.delete', { id: messageId });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await ChatService.searchUsers(searchQuery);
      const arr: User[] = Array.isArray(results) ? results : [results];
      setSearchResults(arr);
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateConversation = async (userId: string) => {
    try {
      const newChat = await ChatService.createConversation(userId);
      setShowNewChatModal(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadChats();
      loadMessages(newChat);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSearchGroupUsers = async () => {
    if (!groupSearchQuery.trim()) return;

    setSearchingGroupUsers(true);
    try {
      const result = await ChatService.searchUsers(groupSearchQuery);
      const arr: User[] = Array.isArray(result) ? result : [result];
      setGroupSearchResults(arr);
    } catch (error) {
      console.error('Failed to search users:', error);
      setGroupSearchResults([]);
    } finally {
      setSearchingGroupUsers(false);
    }
  };

  const handleToggleUserSelection = (user: User) => {
    setSelectedUsers((prev) => (prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert('Please enter a group name and select at least one member');
      return;
    }

    try {
      const userIds = selectedUsers.map((u) => u.id);
      const newGroup = await ChatService.createGroup(groupName, userIds);
      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedUsers([]);
      setGroupSearchQuery('');
      setGroupSearchResults([]);
      await loadChats();
      loadMessages(newGroup);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between gap-2">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Geets</h1>
            <button
              onClick={() => {
                AuthService.logout();
                wsDisconnect();
                router.replace('/login');
              }}
              className="mb-2 px-3 bg-red-700 text-white rounded-lg hover:bg-red-900 text-sm font-medium cursor-pointer"
            >
              <FaSignOutAlt />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewChatModal(true)} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer">
              + Chat
            </button>
            <button onClick={() => setShowNewGroupModal(true)} className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium cursor-pointer">
              + Group
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {chats.length === 0 ? (
            <p className="p-4 text-gray-500 text-center">No conversations yet</p>
          ) :
            chats.map((chat) => {
              const cid = String(chat.id);
              const unread = unreadByChatId[cid] ?? 0;
              const muted = mutedByChatId[cid] ?? false;

              return (
                <div
                  key={chat.id}
                  onClick={() => loadMessages(chat)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition ${
                    selectedChat?.id === chat.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {chat.is_group && <span className="text-lg">👥</span>}

                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold truncate ${unread > 0 ? 'text-gray-900' : 'text-gray-800'}`}>
                        {chat.name || chat.title || 'Unnamed Chat'}
                      </div>
                      <div className="text-xs text-gray-500">{chat.is_group ? 'Group' : 'Direct Message'}</div>
                    </div>

                    {/* per-chat notifications toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleChatMuted(cid);
                      }}
                      className="p-2 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer"
                      title={muted ? 'Enable notifications' : 'Mute notifications'}
                    >
                      {muted ? <FaBellSlash /> : <FaBell />}
                    </button>

                    {unread > 0 && (
                      <div className="ml-1 text-xs bg-red-600 text-white rounded-full px-2 py-1">
                        {unread > 99 ? '99+' : unread}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
}
        </div>

        <div className="p-3 border-t border-gray-200 text-xs text-gray-500">{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedChat ? (
          <>
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-justify items-center gap-2">
                  {selectedChat.is_group && <span className="text-2xl">👥</span>}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{selectedChat.name || selectedChat.title || 'Chat'}</h2>
                    <div className="text-sm text-gray-500">
                      {selectedChat.is_group ? <span>Group • {selectedChat.participants?.length || 0} members</span> : <span>Direct Message</span>}
                    </div>
                  </div>
                </div>

                {selectedChat.is_group && (
                  <button onClick={() => setShowParticipantsModal(true)} className="p-3 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer">
                    <FaUsers />
                  </button>
                )}
              </div>
            </div>

            {/* ✅ ВОТ ТУТ теперь используется MessageList */}
            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              editingMessageId={editingMessageId}
              editingText={editingText}
              onChangeEditingText={setEditingText}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDeleteMessage}
              onBottomVisible={() => {
                sendSeenIfNeeded();
                if (selectedChat) {
                  const cid = String(selectedChat.id);
                  setUnreadByChatId((prev) => {
                    const next = { ...prev };
                    delete next[cid];
                    return next;
                  });
                }
              }}
            />

            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-800"
                  disabled={sendingMessage}
                />
                <button type="submit" disabled={sendingMessage || !newMessage.trim()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 cursor-pointer">
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 bg-white">Select a conversation to start messaging</div>
        )}
      </div>

      {/* New Direct Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800">New Direct Chat</h2>

            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
              />
              <button onClick={handleSearchUsers} disabled={searching || !searchQuery.trim()} className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div key={user.id} onClick={() => handleCreateConversation(user.id)} className="p-3 hover:bg-gray-100 cursor-pointer rounded-lg cursor-pointer">
                    <div className="font-semibold text-gray-800">{user.username}</div>
                    {user.display_name && <div className="text-sm text-gray-500">{user.display_name}</div>}
                  </div>
                ))
              ) : searchQuery && !searching ? (
                <p className="text-gray-500 text-center p-4">No users found</p>
              ) : null}
            </div>

            <button
              onClick={() => {
                setShowNewChatModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-lg max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Create Group</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Members</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Search username..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchGroupUsers()}
                />
                <button onClick={handleSearchGroupUsers} disabled={searchingGroupUsers || !groupSearchQuery.trim()} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 cursor-pointer">
                  Search
                </button>
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected Members ({selectedUsers.length})</label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                      <span>{user.username}</span>
                      <button onClick={() => handleToggleUserSelection(user)} className="text-green-600 hover:text-green-800 font-bold">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto mb-4 min-h-[150px] max-h-[250px]">
              {groupSearchResults.length > 0 ? (
                <div className="border border-gray-200 rounded-lg divide-y">
                  {groupSearchResults.map((user) => {
                    const isSelected = selectedUsers.some((u) => u.id === user.id);
                    return (
                      <div key={user.id} onClick={() => handleToggleUserSelection(user)} className={`p-3 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800">{user.username}</div>
                            {user.display_name && <div className="text-sm text-gray-500">{user.display_name}</div>}
                          </div>
                          {isSelected && <span className="text-green-600">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : groupSearchQuery && !searchingGroupUsers ? (
                <p className="text-gray-500 text-center p-4">No users found</p>
              ) : (
                <p className="text-gray-400 text-center p-4">Search for users to add to group</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedUsers.length === 0} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                Create Group
              </button>
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setGroupName('');
                  setSelectedUsers([]);
                  setGroupSearchQuery('');
                  setGroupSearchResults([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipantsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-lg max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Group Participants</h2>

            <div className="flex-1 overflow-y-auto mb-4 min-h-[150px] max-h-[500px]">
              <div className="border border-gray-200 rounded-lg divide-y">
                {selectedChat?.participants?.map((user) => (
                  <div key={user.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-800">{user.username}</div>
                        {user.display_name && <div className="text-sm text-gray-500">{user.display_name}</div>}
                      </div>

                      {selectedChat?.role === 'ADMIN' && user.id !== currentUserId && (
                        <button
                          onClick={async () => {
                            if (!selectedChat) return;
                            await ChatService.removeGroupParticipant(selectedChat.id, user.id);
                            setSelectedChat((prev) =>
                              prev ? { ...prev, participants: (prev.participants ?? []).filter((p) => p.id !== user.id) } : prev
                            );
                            await loadChats();
                              setShowParticipantsModal(false);
                          }}
                          className="p-3 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer"
                        >
                          <FaTimes />
                        </button>
                      )}

                      {user.id === currentUserId && (
                        <button
                          onClick={async () => {
                            if (!selectedChat) return;

                            await ChatService.removeGroupParticipant(selectedChat.id, user.id);

                            // refresh sidebar and close the chat (you left it)
                            await loadChats();
                            setSelectedChat(null);
                            setMessages([]);
                            setShowParticipantsModal(false);
                          }}
                          className="p-3 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer"
                        >
                          <FaSignOutAlt />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedChat?.role === 'ADMIN' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add Members</label>

                  <div className="mb-4">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search username..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                    />
                    <button onClick={handleSearchUsers} disabled={searching || !searchQuery.trim()} className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 cursor-pointer">
                      {searching ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((user) => (
                        <div
                          key={user.id}
                          onClick={async () => {
                            if (!selectedChat) return;

                            if ((selectedChat.participants ?? []).some((p) => p.id === user.id)) {
                              toast.error('This user is already in the group');
                              return;
                            }

                            await ChatService.addGroupParticipant(selectedChat.id, user.id);
                            setSelectedChat((prev) => (prev ? { ...prev, participants: [...(prev.participants ?? []), user] } : prev));
                            setShowParticipantsModal(false);
                          }}
                          className="p-3 hover:bg-gray-100 cursor-pointer rounded-lg cursor-pointer"
                        >
                          <div className="font-semibold text-gray-800">{user.username}</div>
                          {user.display_name && <div className="text-sm text-gray-500">{user.display_name}</div>}
                        </div>
                      ))
                    ) : searchQuery && !searching ? (
                      <p className="text-gray-500 text-center p-4">No users found</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowParticipantsModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
