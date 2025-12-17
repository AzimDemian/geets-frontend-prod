'use client';

import { useState } from 'react';
import { ChatService } from '@/services/chat.service';
import { User, Chat } from '@/types/chat';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (chat: Chat) => void;
};

export function NewChatModal({ open, onClose, onCreated }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  if (!open) return null;

  const search = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const r = await ChatService.searchUsers(searchQuery);
      const arr = Array.isArray(r) ? r : [r];
      setResults(arr);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const create = async (userId: string) => {
    const newChat = await ChatService.createConversation(userId);
    onCreated(newChat);
    setSearchQuery('');
    setResults([]);
    onClose();
  };

  return (
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
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button
            onClick={search}
            disabled={searching || !searchQuery.trim()}
            className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto">
          {results.length > 0 ? (
            results.map((u) => (
              <div
                key={u.id}
                onClick={() => create(u.id)}
                className="p-3 hover:bg-gray-100 cursor-pointer rounded-lg"
              >
                <div className="font-semibold text-gray-800">{u.username}</div>
                {u.display_name && <div className="text-sm text-gray-500">{u.display_name}</div>}
              </div>
            ))
          ) : searchQuery && !searching ? (
            <p className="text-gray-500 text-center p-4">No users found</p>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
