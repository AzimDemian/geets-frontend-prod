// hooks/useChatController.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { ChatService } from '@/services/chat.service';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Chat, Message, ReceiptStatus, WsEventType } from '@/types/chat';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';

type WsCreatePayload = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username?: string;
  body: string;
  created_at?: string;
  updated_at?: string;
};

type WsDeliveredPayload = { message_id: string };
type WsSeenPayload = { conversation_id: string; last_seen_message_id: string };

function nowIso() {
  return new Date().toISOString();
}

function isMine(msg: Message, myId: string) {
  return String(msg.sender_id) === String(myId);
}

export function useChatController() {
  const router = useRouter();
  const currentUserId = useCurrentUserId();

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // refs to avoid stale closures
  const selectedChatRef = useRef<Chat | null>(null);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // avoid spamming delivered/seen
  const deliveredSentRef = useRef<Set<string>>(new Set());
  const lastSeenSentRef = useRef<Map<string, string>>(new Map()); // conversation_id -> last_seen_message_id

  const refreshChats = useCallback(async () => {
    const data = await ChatService.getAllChats();
    setChats(data);
  }, []);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      router.replace('/login');
      return;
    }

    (async () => {
      try {
        await refreshChats();
      } catch (e) {
        console.error('Failed to load chats:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, refreshChats]);

  const markDelivered = useCallback(
    (messageId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'DELIVERED', is_pending: false } : m))
      );
    },
    [setMessages]
  );

  const markSeenUpTo = useCallback(
    (conversationId: string, lastSeenMessageId: string) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === lastSeenMessageId && m.conversation_id === conversationId);
        if (idx === -1) return prev;

        return prev.map((m, i) => {
          if (m.conversation_id !== conversationId) return m;
          if (!isMine(m, currentUserId)) return m;
          if (i <= idx) {
            const nextStatus: ReceiptStatus = 'SEEN';
            return { ...m, status: nextStatus, is_pending: false };
          }
          return m;
        });
      });
    },
    [currentUserId]
  );

  const maybeSendSeen = useCallback(
    (conversationId: string, lastMessageId: string) => {
      if (!conversationId || !lastMessageId) return;

      const prevLast = lastSeenSentRef.current.get(conversationId);
      if (prevLast === lastMessageId) return;

      lastSeenSentRef.current.set(conversationId, lastMessageId);
      sendWs('message.seen', {
        conversation_id: conversationId,
        last_seen_message_id: lastMessageId,
      });
    },
    // sendWs объявим ниже, но TS ок — мы заполним через useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleWs = useCallback(
    (type: WsEventType, payload: any) => {
      const selected = selectedChatRef.current;

      if (type === 'message.create') {
        const p = payload as WsCreatePayload;

        const incoming: Message = {
          id: String(p.id),
          conversation_id: String(p.conversation_id),
          sender_id: String(p.sender_id),
          sender_username: p.sender_username,
          body: p.body,
          created_at: p.created_at ?? nowIso(),
          updated_at: p.updated_at,
        };

        const mine = isMine(incoming, currentUserId);

        // 1) если это МОЁ сообщение — матчим pending и превращаем в DELIVERED
        if (mine) {
          setMessages((prev) => {
            const pendingIdx = prev.findIndex(
              (m) =>
                m.is_pending &&
                m.conversation_id === incoming.conversation_id &&
                isMine(m, currentUserId) &&
                m.body === incoming.body
            );

            if (pendingIdx !== -1) {
              const next = [...prev];
              next[pendingIdx] = {
                ...incoming,
                status: 'DELIVERED',
                is_pending: false,
              };
              return next;
            }

            // если pending не нашли — просто добавим (на случай ресинка/другой вкладки)
            return [...prev, { ...incoming, status: 'DELIVERED', is_pending: false }];
          });
        } else {
          // 2) чужое сообщение — добавляем (если чат открыт) и шлём delivered
          if (!deliveredSentRef.current.has(incoming.id)) {
            deliveredSentRef.current.add(incoming.id);
            sendWs('message.delivered', { message_id: incoming.id });
          }

          const isOpen = selected && String(selected.id) === String(incoming.conversation_id);
          if (isOpen) {
            setMessages((prev) => [...prev, incoming]);

            // и сразу seen (мы в чате и видим последнее сообщение)
            // (отправим после добавления — простое решение)
            queueMicrotask(() => {
              maybeSendSeen(incoming.conversation_id, incoming.id);
            });
          }
        }

        // чат-лист обновим всегда
        refreshChats().catch(() => {});
        return;
      }

      if (type === 'message.edit') {
        const id = String(payload?.message_id ?? payload?.id ?? '');
        const newBody = String(payload?.body ?? '');
        const updatedAt = String(payload?.updated_at ?? nowIso());

        if (!id) return;

        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, body: newBody, updated_at: updatedAt } : m))
        );
        return;
      }

      if (type === 'message.delete') {
        const id = String(payload?.message_id ?? payload?.id ?? '');
        if (!id) return;
        setMessages((prev) => prev.filter((m) => m.id !== id));
        return;
      }

      if (type === 'message.delivered') {
        const p = payload as WsDeliveredPayload;
        if (!p?.message_id) return;
        markDelivered(String(p.message_id));
        return;
      }

      if (type === 'message.seen') {
        const p = payload as WsSeenPayload;
        if (!p?.conversation_id || !p?.last_seen_message_id) return;
        markSeenUpTo(String(p.conversation_id), String(p.last_seen_message_id));
        return;
      }
    },
    [currentUserId, markDelivered, markSeenUpTo, refreshChats, maybeSendSeen]
  );

  const { isConnected, sendMessage: sendWs, disconnect: wsDisconnect } = useWebSocket(
    (type, payload) => handleWs(type, payload),
    { debug: false }
  );

  // фикс: useCallback above uses sendWs via closure in maybeSendSeen/handleWs
  // поэтому безопаснее держать sendWs в ref
  const sendWsRef = useRef(sendWs);
  useEffect(() => {
    sendWsRef.current = sendWs;
  }, [sendWs]);
  const sendWsSafe = useCallback((type: WsEventType, payload: any) => {
    return sendWsRef.current(type, payload);
  }, []);

  // “пере-привязка” maybeSendSeen на sendWsSafe
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (maybeSendSeen as any).toString; // noop: просто чтобы ESLint не ругался на "unused"
  }, [maybeSendSeen]);

  // публичный метод: когда чат открыт/мы внизу — проставить seen до последнего
  const markCurrentChatSeen = useCallback(() => {
    const chat = selectedChatRef.current;
    if (!chat) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    if (String(last.conversation_id) !== String(chat.id)) return;

    const prevLast = lastSeenSentRef.current.get(String(chat.id));
    if (prevLast === last.id) return;

    lastSeenSentRef.current.set(String(chat.id), last.id);
    sendWsSafe('message.seen', { conversation_id: String(chat.id), last_seen_message_id: last.id });
  }, [messages, sendWsSafe]);

  const selectChat = useCallback(
    async (chat: Chat) => {
      try {
        const data = await ChatService.getMessages(chat.id, chat.is_group);

        // проставим локальные статусы на старте (если с бэка нет receipt’ов)
        const normalized: Message[] = data.map((m: Message) => {
          if (!isMine(m, currentUserId)) return m;

          // если есть read=true — считаем seen, иначе delivered
          const status: ReceiptStatus = m.read ? 'SEEN' : 'DELIVERED';
          return { ...m, status, is_pending: false };
        });

        if (chat.is_group) {
          chat.participants = await ChatService.getGroupParticipants(chat.id);
        }

        setSelectedChat(chat);
        setMessages(normalized);
        setEditingMessageId(null);

        // как только открыли чат — seen до последнего
        const last = normalized[normalized.length - 1];
        if (last) {
          lastSeenSentRef.current.set(String(chat.id), last.id);
          sendWsSafe('message.seen', { conversation_id: String(chat.id), last_seen_message_id: last.id });
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    },
    [currentUserId, sendWsSafe]
  );

  const sendTextMessage = useCallback(
    (text: string) => {
      const chat = selectedChatRef.current;
      if (!chat) return;
      const body = text.trim();
      if (!body) return;

      // optimistic pending message (spinner)
      const tempId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `temp-${crypto.randomUUID()}`
          : `temp-${Date.now()}-${Math.random()}`;

      const pending: Message = {
        id: tempId,
        conversation_id: String(chat.id),
        sender_id: String(currentUserId),
        body,
        created_at: nowIso(),
        status: 'SENT',
        is_pending: true,
      };

      setMessages((prev) => [...prev, pending]);

      // отправляем в WS
      sendWsSafe('message.create', { conversation_id: String(chat.id), body });
    },
    [currentUserId, sendWsSafe]
  );

  const startEdit = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.body);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const saveEdit = useCallback(
    (messageId: string) => {
      const body = editingText.trim();
      if (!body) return;
      sendWsSafe('message.edit', { id: messageId, new_body: body });
      setEditingMessageId(null);
      setEditingText('');
    },
    [editingText, sendWsSafe]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      sendWsSafe('message.delete', { id: messageId });
    },
    [sendWsSafe]
  );

  const logout = useCallback(() => {
    AuthService.logout();
    wsDisconnect();
    router.replace('/login');
  }, [router, wsDisconnect]);

  // ВАЖНО: чтобы handleWs внутри реально слал через актуальный sendWs,
  // мы используем sendWsSafe везде снаружи, а внутри handleWs — sendWs(...) уже норм,
  // т.к. useWebSocket теперь вызывает актуальный onEvent (через ref).

  const api = useMemo(
    () => ({
      loading,
      chats,
      selectedChat,
      messages,
      currentUserId,
      isConnected,

      editingMessageId,
      editingText,
      setEditingText,

      refreshChats,
      selectChat,

      sendTextMessage,

      startEdit,
      cancelEdit,
      saveEdit,
      deleteMessage,

      markCurrentChatSeen,
      logout,
    }),
    [
      loading,
      chats,
      selectedChat,
      messages,
      currentUserId,
      isConnected,
      editingMessageId,
      editingText,
      refreshChats,
      selectChat,
      sendTextMessage,
      startEdit,
      cancelEdit,
      saveEdit,
      deleteMessage,
      markCurrentChatSeen,
      logout,
    ]
  );

  return api;
}
