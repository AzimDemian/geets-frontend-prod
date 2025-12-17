'use client';

import { useState } from 'react';
import { ChatService } from '@/services/chat.service';
import { Chat, User } from '@/types/chat';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (chat: Chat) => void;
};

export function NewGroupModal({ open, onClose, onCreated }: Props) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  if (!open) return null;

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await ChatService.searchUsers(query);
      setResults(Array.isArray(r) ? r : [r]);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const toggle = (u: User) => {
    setSelectedUsers((prev) =>
      prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]
    );
  };

  const create = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const ids = selectedUsers.map((u) => u.id);
    const g = await ChatService.createGroup(groupName, ids);
    onCreated(g);
    setGroupName('');
    setSelectedUsers([]);
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <button
              onClick={search}
              disabled={searching || !query.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Members ({selectedUsers.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                >
                  <span>{u.username}</span>
                  <button onClick={() => toggle(u)} className="text-green-600 hover:text-green-800 font-bold">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mb-4 min-h-[150px] max-h-[250px]">
          {results.length > 0 ? (
            <div className="border border-gray-200 rounded-lg divide-y">
              {results.map((u) => {
                const isSelected = selectedUsers.some((x) => x.id === u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggle(u)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-800">{u.username}</div>
                        {u.display_name && <div className="text-sm text-gray-500">{u.display_name}</div>}
                      </div>
                      {isSelected && <span className="text-green-600">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query && !searching ? (
            <p className="text-gray-500 text-center p-4">No users found</p>
          ) : (
            <p className="text-gray-400 text-center p-4">Search for users to add to group</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={create}
            disabled={!groupName.trim() || selectedUsers.length === 0}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            Create Group
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
