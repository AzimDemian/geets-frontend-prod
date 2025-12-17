'use client';

import { useState } from 'react';

type Props = {
  disabled?: boolean;
  onSend: (text: string) => Promise<void> | void;
};

export function Composer({ disabled, onSend }: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled || sending) return;

    setSending(true);
    try {
      await onSend(text);
      setValue('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-800"
          disabled={disabled || sending}
        />
        <button
          type="submit"
          disabled={disabled || sending || !value.trim()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
}
