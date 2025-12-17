export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
}

export interface ValidationError {
  detail: string;
}

// User type
export interface User {
  id: string;
  username: string;
}

// Password validation regex (8-100 chars, at least 1 letter and 1 number)
export const PASSWORD_REGEX = /^(?=.{8,100}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

// Helper function to validate password
export function isValidPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}