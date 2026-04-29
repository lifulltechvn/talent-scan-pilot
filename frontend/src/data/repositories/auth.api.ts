import { apiClient } from '../api/client';
import type { User, AuthTokens } from '@/domain/models/user';

export const authApi = {
  async login(email: string, password: string): Promise<AuthTokens> {
    // Server uses OAuth2PasswordRequestForm (form-encoded, field is "username")
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const { data } = await apiClient.post<AuthTokens>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  },

  async register(email: string, password: string, fullName: string): Promise<User> {
    const { data } = await apiClient.post<User>('/auth/register', { email, password, full_name: fullName });
    return data;
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>('/auth/refresh', { refresh_token: refreshToken });
    return data;
  },
};
