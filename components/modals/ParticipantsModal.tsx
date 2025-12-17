'use client';

import { useState } from 'react';
import { ChatService } from '@/services/chat.service';
import { Chat, User } from '@/types/chat';
import { FaTimes, FaSignOutAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';

type Props = {
  open: boolean;
  chat: Chat;
  currentUserId: string;

  onClose: () => void;
  onRemove: (userId: string) => Promise<void>;
  onAdd: (user: User) => Promise<void>;
};

export function ParticipantsModal({ open, chat, currentUserId, onClose, onRemove, onAdd }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  if (!open) return null;

  const isAdmin = chat.role === 'ADMIN';

  const search = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const r = await ChatService.searchUsers(searchQuery);
      setResults(Array.isArray(r) ? r : [r]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] shadow-lg max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Group Participants</h2>

        <div className="flex-1 overflow-y-auto mb-4 min-h-[150px] max-h-[500px]">
          <div className="border border-gray-200 rounded-lg divide-y">
            {chat.participants?.map((u) => (
              <div key={u.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">{u.username}</div>
                    {u.display_name && <div className="text-sm text-gray-500">{u.display_name}</div>}
                  </div>

                  {isAdmin && u.id !== currentUserId && (
                    <button
                      onClick={async () => {
                        await onRemove(u.id);
                      }}
                      className="p-3 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer"
                      title="Remove"
                    >
                      <FaTimes />
                    </button>
                  )}

                  {u.id === currentUserId && (
                    <button
                      onClick={async () => {
                        await onRemove(u.id);
                        onClose();
                      }}
                      className="p-3 bg-transparent text-gray-400 rounded-lg hover:bg-gray-200 text-lg font-medium cursor-pointer"
                      title="Leave group"
                    >
                      <FaSignOutAlt />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Members</label>

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
                  className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 cursor-pointer"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto">
                {results.length > 0 ? (
                  results.map((u) => (
                    <div
                      key={u.id}
                      onClick={async () => {
                        const already = chat.participants?.some((p) => p.id === u.id);
                        if (already) {
                          toast.error('This user is already in the group');
                          return;
                        }
                        await onAdd(u);
                        onClose();
                      }}
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
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
