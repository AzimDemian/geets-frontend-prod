import { LoginRequest, AuthResponse } from '@/types/auth';
import { jwtDecode } from "jwt-decode";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface JwtPayload {
  sub: string;
  name: string;
  exp: number;
}

  
export class AuthService {
  static async register(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  }

  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('Login response status:', response.status);
    console.log('Login response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        throw new Error('Incorrect username or password');
      }
      throw new Error(error.detail || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    console.log('Login data received:', data);
    console.log('Token from response:', data.token);
    
    this.saveToken(data.token);
    console.log('Token saved, checking localStorage:', localStorage.getItem('auth_token'));
    
    return data;
  }

  static logout(): void {
    localStorage.removeItem('auth_token');
  }

  static saveToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  static getToken(): string | null {
    const token = localStorage.getItem('auth_token');

    if (!token) return null;

    const decodedToken = jwtDecode<JwtPayload>(token);
    if (decodedToken.exp * 1000 <= Date.now()) {
      localStorage.removeItem('auth_token');
      return null;
    }

    return token;
  }

  static removeToken(): void {
    localStorage.removeItem('auth_token');
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}