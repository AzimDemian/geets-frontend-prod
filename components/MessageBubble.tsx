// components/MessageBubble.tsx
'use client';

import type { Message } from '@/types/chat';

type Props = {
  message: Message;
  isMine: boolean;
  isEditing?: boolean;
  editingText?: string;
  onChangeEditingText?: (v: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onStartEdit?: () => void;
  onDelete?: () => void;
};

function ReceiptIcon({ message }: { message: Message }) {
  // sent = loader (pending)
  if (message.is_pending || message.status === 'SENT') {
    return <span className="text-xs opacity-80">⏳</span>;
  }
  if (message.status === 'SEEN') {
    return <span className="text-xs opacity-80">✓✓</span>;
  }
  // DELIVERED
  return <span className="text-xs opacity-80">✓</span>;
}

export default function MessageBubble({
  message,
  isMine,
  isEditing,
  editingText,
  onChangeEditingText,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
}: Props) {
  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <div
        className={`group relative max-w-md rounded-lg p-3 shadow-sm border ${
          isMine
            ? 'bg-indigo-600 text-white border-indigo-700'
            : 'bg-gray-100 text-gray-900 border-gray-200'
        }`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editingText ?? ''}
              onChange={(e) => onChangeEditingText?.(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit?.();
                if (e.key === 'Escape') onCancelEdit?.();
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={onSaveEdit}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isMine && message.sender_username ? (
              <>
                <p className="font-bold">{message.sender_username}</p>
                <hr className="my-1 opacity-30" />
              </>
            ) : null}

            <p className={isMine ? 'text-white' : 'text-gray-900'}>{message.body}</p>

            <div className="text-xs opacity-70 mt-1 flex items-center gap-2 justify-end">
              <span>{new Date(message.created_at + 'Z').toLocaleTimeString()}</span>
              {isMine ? <ReceiptIcon message={message} /> : null}
            </div>

            {isMine && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={onStartEdit}
                  className="p-1 bg-white text-gray-600 rounded hover:bg-gray-100 text-xs"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 bg-white text-red-600 rounded hover:bg-red-50 text-xs"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
