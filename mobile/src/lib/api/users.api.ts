import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { Address, CreateAddressInput } from '../../types';

export const usersApi = {
  me() {
    return apiGet<{ id: string; email: string; phone?: string; profile?: { fullName?: string; avatarUrl?: string } }>(
      '/users/me',
    );
  },
  listAddresses() {
    return apiGet<Address[]>('/users/me/addresses');
  },
  createAddress(input: CreateAddressInput) {
    return apiPost<Address>('/users/me/addresses', input);
  },
  updateAddress(id: string, input: CreateAddressInput) {
    return apiPatch<Address>(`/users/me/addresses/${id}`, input);
  },
  deleteAddress(id: string) {
    return apiDelete<{ message: string }>(`/users/me/addresses/${id}`);
  },
};
