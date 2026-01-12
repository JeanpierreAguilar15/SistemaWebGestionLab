import { api } from '@/lib/api';

export interface SystemConfig {
  codigo_config: number;
  clave: string;
  valor: string;
  descripcion?: string;
  grupo: string;
  tipo_dato: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  es_publico: boolean;
}

export interface CreateSystemConfigDto {
  clave: string;
  valor: string;
  descripcion?: string;
  grupo: string;
  tipo_dato?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  es_publico?: boolean;
}

export interface UpdateSystemConfigDto extends Partial<CreateSystemConfigDto> { }

export const systemConfigService = {
  getAll: async (token?: string): Promise<SystemConfig[]> => {
    const response = await api.get<{ data: SystemConfig[] }>('/system-config', { token });
    return response.data || (response as any); // Handle potential response structure differences
  },

  getPublic: async (): Promise<Record<string, any>> => {
    const response = await api.get<{ data: Record<string, any> }>('/system-config/public');
    return response.data || (response as any);
  },

  getById: async (id: number, token: string): Promise<SystemConfig> => {
    const response = await api.get<{ data: SystemConfig }>(`/system-config/${id}`, { token });
    return response.data || (response as any);
  },

  create: async (data: CreateSystemConfigDto, token: string): Promise<SystemConfig> => {
    const response = await api.post<{ data: SystemConfig }>('/system-config', data, { token });
    return response.data || (response as any);
  },

  update: async (id: number, data: UpdateSystemConfigDto, token: string): Promise<SystemConfig> => {
    const response = await api.put<{ data: SystemConfig }>(`/system-config/${id}`, data, { token });
    return response.data || (response as any);
  },

  delete: async (id: number, token: string): Promise<void> => {
    await api.delete(`/system-config/${id}`, { token });
  },
};