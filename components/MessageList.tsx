'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import MessageBubble from './MessageBubble';

type Props = {
  messages: Message[];
  currentUserId: string;

  editingMessageId: string | null;
  editingText: string;
  onChangeEditingText: (v: string) => void;

  onStartEdit: (m: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;

  onBottomVisible?: () => void;
};

export function MessageList({
  messages,
  currentUserId,
  editingMessageId,
  editingText,
  onChangeEditingText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onBottomVisible,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const threshold = 80;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      isAtBottomRef.current = atBottom;
      if (atBottom) onBottomVisible?.();
    };

    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [onBottomVisible]);

  useEffect(() => {
    if (!isAtBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length]);


  return (
    <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
      {messages.map((m) => {
        const isMine = String(m.sender_id) === currentUserId;
        const isEditing = editingMessageId === m.id;

        return (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={isMine}
            isEditing={isEditing}
            editingText={isEditing ? editingText : m.body}
            onChangeEditingText={onChangeEditingText}
            onStartEdit={() => onStartEdit(m)}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onDelete={() => onDelete(m.id)}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
