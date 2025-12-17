'use client';

import { Chat } from '@/types/chat';
import { FaUsers } from 'react-icons/fa';

type Props = {
  chat: Chat;
  onOpenParticipants: () => void;
};

export function ChatHeader({ chat, onOpenParticipants }: Props) {
  return (
    <div className="border-b border-gray-200 p-4 bg-gray-50">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          {chat.is_group && <span className="text-2xl">👥</span>}
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {chat.name || chat.title || 'Chat'}
            </h2>
            <div className="text-sm text-gray-500">
              {chat.is_group ? (
                <span>Group • {chat.participants?.length || 0} members</span>
              ) : (
                <span>Direct Message</span>
              )}
            </div>
          </div>
        </div>

        {chat.is_group && (
          <button
            onClick={onOpenParticipants}
            className="p-3 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer"
            title="Participants"
          >
            <FaUsers />
          </button>
        )}
      </div>
    </div>
  );
}
