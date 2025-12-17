'use client';

import { Chat } from '@/types/chat';
import { FaSignOutAlt } from 'react-icons/fa';

type Props = {
  chats: Chat[];
  selectedChatId: string | null;
  isConnected: boolean;
  onSelectChat: (chat: Chat) => void;
  onLogout: () => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
};

export function Sidebar({
  chats,
  selectedChatId,
  isConnected,
  onSelectChat,
  onLogout,
  onOpenNewChat,
  onOpenNewGroup,
}: Props) {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Geets</h1>
          <button
            onClick={onLogout}
            className="mb-2 px-3 bg-red-700 text-white rounded-lg hover:bg-red-900 text-sm font-medium cursor-pointer"
            title="Logout"
          >
            <FaSignOutAlt />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onOpenNewChat}
            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer"
          >
            + Chat
          </button>
          <button
            onClick={onOpenNewGroup}
            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium cursor-pointer"
          >
            + Group
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {chats.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No conversations yet</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition ${
                selectedChatId === chat.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {chat.is_group && <span className="text-lg">👥</span>}
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">
                    {chat.name || chat.title || 'Unnamed Chat'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {chat.is_group ? 'Group' : 'Direct Message'}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-200 text-xs text-gray-500">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
    </div>
  );
}
