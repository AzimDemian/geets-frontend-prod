import { Chat, Message } from '@/types/chat';
import { AuthService } from './auth.service';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ChatService {
  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };  
  }

  static async getAllChats() {
    const token = AuthService.getToken();
    const response_conversations = await fetch(`${API_BASE_URL}/api/conversations`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const response_groups = await fetch(`${API_BASE_URL}/api/groups`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response_conversations.ok || !response_groups.ok) throw new Error('Failed to fetch chats');

    const conversations = await response_conversations.json();
    const groups = await response_groups.json();
  
    return [...conversations, ...groups];
  }

  static async getMessages(chatId: string, isGroup: boolean = false, limit: number = 50) {
    const token = AuthService.getToken();
    const endpoint = isGroup 
      ? `/api/groups/${chatId}/messages`
      : `/api/conversations/${chatId}/messages`;
    
    const response = await fetch(`${API_BASE_URL}${endpoint}?limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch messages');
    return await response.json();
  }

// NEW - Fixed:
static async searchUsers(query: string) {
  const token = AuthService.getToken();
  const response = await fetch(
    `${API_BASE_URL}/api/users/search?username=${encodeURIComponent(query)}`,  // ✅ sending 'username'
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) throw new Error('Failed to search users');
  return response.json();
}

 static async createConversation(participantId: string): Promise<Chat> {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    console.log('Creating conversation with participant:', participantId);

    const response = await fetch(`${API_BASE_URL}/api/conversations/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ other_id: participantId }),
    });

    console.log('Create conversation response:', response.status);

    if (!response.ok) {
      const errorJson = await response.json();
      console.error('Create conversation error:', JSON.stringify(errorJson));
      throw new Error(`Failed to create conversation: ${errorJson['detail']}`);
    }

    return response.json();
  }

  static async getGroupParticipants(groupId: string) {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/participants`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorJson = await response.json();
      console.error('Get group participants error:', JSON.stringify(errorJson));
      throw new Error(`Failed to get group participants: ${errorJson['detail']}`);
    }

    return await response.json();
  }

  static async addGroupParticipant(groupId: string, participantId: string) {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/participants/${participantId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorJson = await response.json();
      console.error('Add group participant error:', JSON.stringify(errorJson));
      throw new Error(`Failed to add group participant: ${errorJson['detail']}`);
    }

    return true;
  }

  static async removeGroupParticipant(groupId: string, participantId: string) {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/participants/${participantId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorJson = await response.json();
      console.error('Remove group participant error:', JSON.stringify(errorJson));
      throw new Error(`Failed to remove group participant: ${errorJson['detail']}`);
    }

    return true;
  }


  static async createGroup(name: string, userIds: string[]) {
    const token = AuthService.getToken();
    const response = await fetch(`${API_BASE_URL}/api/groups/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title: name, participant_ids: userIds }),
    });
    if (!response.ok) throw new Error('Failed to create group');
    return response.json();
  }

  static async sendMessage(conversationId: string, body: string, isGroup: boolean = false) {
    const token = AuthService.getToken();
    const endpoint = isGroup
      ? `/api/groups/${conversationId}/messages`
      : `/api/conversations/${conversationId}/messages`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }
}