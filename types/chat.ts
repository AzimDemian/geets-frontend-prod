// types/chat.ts

export type ReceiptStatus = 'SENT' | 'DELIVERED' | 'SEEN';

export interface User {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  created_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username?: string;
  body: string;
  created_at: string;
  updated_at?: string;

  // backend/old
  read?: boolean;

  // receipts UI
  status?: ReceiptStatus;
  delivered_at?: string | null;
  seen_at?: string | null;

  // local-only (для "sent" как loader)
  is_pending?: boolean;
}

export interface Chat {
  id: string;
  name?: string;
  title?: string;
  is_group: boolean;
  role: string;
  participants?: User[];
  last_message?: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

export type Conversation = Chat;

export type WsEventType =
  | 'ping'
  | 'pong'
  | 'message.create'
  | 'message.edit'
  | 'message.delete'
  | 'message.delivered'
  | 'message.seen'
  | string;

export interface WebSocketMessage<TPayload = any> {
  type: WsEventType;
  payload: TPayload;
}
