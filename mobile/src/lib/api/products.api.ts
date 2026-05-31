import { apiGet, apiGetRaw } from './client';
import { Paginated, ProductDetail, ProductListItem } from '../../types';

/**
 * San pham luon truy van theo store da resolve (autoAssignedStore.storeId).
 * storeId chi la context hien thi; checkout van resolve lai tu dia chi cuoi.
 */
export const productsApi = {
  listByStore(
    storeId: string,
    params?: { q?: string; categoryId?: string; sort?: string; page?: number; limit?: number },
  ) {
    return apiGetRaw<Paginated<ProductListItem>>(`/stores/${storeId}/products`, {
      params,
    });
  },
  detailByStore(storeId: string, slug: string) {
    return apiGet<ProductDetail>(`/stores/${storeId}/products/${slug}`);
  },
};
