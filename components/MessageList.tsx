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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    onBottomVisible?.();
  }, [messages.length, onBottomVisible]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
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
