
import { apiJson } from './client';
import type { RegionItem } from '../data/mockData';

export interface LeadItem {
    id: number;
    region_id: number;
    name: string;
    inn?: string | null;
    industry?: string | null;
    revenue?: number | null;
    address?: string;
    phone?: string;
    lat?: number | string | null;
    lon?: number | string | null;
    is_client: boolean;
    score?: number;
    priority?: 'high' | 'low' | string;
}

export interface RegionsFilters {
    region?: string;
    industry?: string;
    category?: string;
    is_client?: boolean;
    min_employees?: number;
    founded_from?: number;
}

function toQuery(filters: RegionsFilters = {}): string {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const str = qs.toString();
    return str ? `?${str}` : '';
}

export async function fetchRegions(filters: RegionsFilters = {}): Promise<RegionItem[]> {
    const res = await apiJson<{ data: any[] }>(`/regions${toQuery(filters)}`);
    return (res.data ?? []).map((r) => ({
        ...r,
        latitude: r.lat ?? r.center?.lat ?? null,
        longitude: r.lon ?? r.center?.lon ?? null,
    })) as RegionItem[];
}

export const fetchRegionsStats = (filters: RegionsFilters = {}) =>
    apiJson<any>(`/regions/stats${toQuery(filters)}`);

export const fetchRegionDetail = (id: number) => apiJson<any>(`/regions/${id}`);

export const fetchRegionsByIndustry = (filters: RegionsFilters = {}) =>
    apiJson<{ data: any[] }>(`/regions/by-industry${toQuery(filters)}`);

export async function fetchRegionLeads(
    regionId: number,
    status?: 'leads' | 'clients'
): Promise<LeadItem[]> {
    const q = status ? `?status=${status}` : '';
    const res = await apiJson<any>(`/regions/${regionId}/leads${q}`);
    return Array.isArray(res) ? res : res?.data ?? [];
}
