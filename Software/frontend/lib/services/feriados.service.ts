import { api } from '@/lib/api';

export interface Feriado {
    codigo_feriado: number;
    fecha: string;
    descripcion: string;
    activo: boolean;
}

export const feriadosService = {
    getAll: async (token?: string) => {
        return api.get<Feriado[]>('/feriados', { token });
    },

    create: async (data: { fecha: string; descripcion: string; activo?: boolean }, token: string) => {
        return api.post<Feriado>('/feriados', data, { token });
    },

    update: async (id: number, data: Partial<Feriado>, token: string) => {
        return api.put<Feriado>(`/feriados/${id}`, data, { token });
    },

    delete: async (id: number, token: string) => {
        return api.delete<{ message: string }>(`/feriados/${id}`, { token });
    },
};
