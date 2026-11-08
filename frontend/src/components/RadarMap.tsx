import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure global Leaflet is present for plugins
if (typeof window !== 'undefined' && !(window as any).L) {
    (window as any).L = L;
}
import 'leaflet.heat';

// Защита leaflet.heat от перерисовки на удалённой карте / нулевом размере
const HL = (L as any).HeatLayer;
if (HL && !HL.prototype.__patched) {
    const origRedraw = HL.prototype._redraw;
    HL.prototype._redraw = function () {
        if (!this._map) return;
        const s = this._map.getSize();
        if (!s.x || !s.y) return;
        return origRedraw.call(this);
    };
    HL.prototype.__patched = true;
}

import type { RegionItem } from '../data/mockData';
import { fetchRegionLeads, LeadItem } from '../api/regions';
import { generateCommercialOfferDoc } from '../utils/docGenerator';
import { Layers, Flame, Building2, Maximize2, MapPin } from 'lucide-react';

interface RadarMapProps {
    regions: RegionItem[];
    selectedRegion?: string;
    selectedRegionDetail?: RegionItem | null;
    onSelectRegion?: (region: RegionItem) => void;
    onOpenCompanies?: (region: RegionItem | null) => void;
    onGenerateDoc?: (companyOrRegion: any) => void;
}

const TILE_PROVIDERS = {
    osm: {
        name: 'OpenStreetMap (Стандартная)',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ПАО «Ростелеком»',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
    },
    esri: {
        name: 'Светлая подложка (Esri Light Gray)',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | ПАО «Ростелеком»',
        maxZoom: 16,
        subdomains: [] as string[],
    },
};

const MAX_LEAD_POINTS = 1500;
const COLOR_WHITE_SPOT = '#FF4F12';
const COLOR_COVERED = '#7700FF';
const COLOR_EMPTY = '#9ca3af';

// Пороги показа подписей на карте
const ZOOM_LABELS_TOP = 8; // подписи только у топ-N районов
const ZOOM_LABELS_ALL = 10; // подписи у всех
const TOP_LABELS_COUNT = 25;

const escapeHtml = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const num = (v: any, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

// Точки тепловой карты: [lat, lon, интенсивность 0..1], нормировка по максимуму компаний
function buildHeatPoints(regions: RegionItem[], selectedRegion: string): [number, number, number][] {
    const filterAll =
        !selectedRegion ||
        selectedRegion === 'Все регионы' ||
        selectedRegion.toLowerCase().includes('регионы рф');
    const maxCompanies = Math.max(1, ...regions.map((r: any) => num(r.companies_count)));
    const pts: [number, number, number][] = [];

    regions.forEach((r: any) => {
        if (!r.latitude || !r.longitude) return;
        if (!filterAll && !String(r.name).toLowerCase().includes(selectedRegion.toLowerCase())) return;

        const byCompanies = num(r.companies_count) / maxCompanies;
        const intensity = Math.min(1, Math.max(num(r.heat), byCompanies, num(r.companies_count) > 0 ? 0.15 : 0));
        if (intensity > 0) pts.push([r.latitude, r.longitude, intensity]);
    });
    return pts;
}

const LABEL_CSS = `
.gis-region-label {
  background: rgba(255,255,255,0.95);
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
  color: #111827;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  white-space: nowrap;
}
.gis-region-label::before { display: none; }
.gis-region-label--selected { border-color: #111827; font-size: 12px; }
`;

export const RadarMap: React.FC<RadarMapProps> = ({
                                                      regions: regionsRaw,
                                                      selectedRegion = 'Все регионы',
                                                      selectedRegionDetail,
                                                      onSelectRegion,
                                                      onOpenCompanies,
                                                      onGenerateDoc,
                                                  }) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const heatLayerRef = useRef<any>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const companyMarkersLayerRef = useRef<L.LayerGroup | null>(null);
    const markerLookupRef = useRef<Record<number, L.CircleMarker>>({});

    // Колбэки в ref: родитель передаёт новые inline-функции на каждый рендер
    const cbRef = useRef({ onSelectRegion, onOpenCompanies, onGenerateDoc });
    cbRef.current = { onSelectRegion, onOpenCompanies, onGenerateDoc };

    // Нормализация данных API
    const regions = useMemo<RegionItem[]>(
        () =>
            (regionsRaw || []).map((r: any) => ({
                ...r,
                latitude: r.latitude ?? r.lat ?? r.center?.lat ?? null,
                longitude: r.longitude ?? r.lon ?? r.center?.lon ?? null,
                revenue: r.revenue ?? r.total_revenue ?? 0,
            })) as RegionItem[],
        [regionsRaw]
    );

    // Топ районов по числу компаний — им подписи показываются раньше остальных
    const topIds = useMemo(() => {
        const set = new Set<number>();
        [...regions]
            .sort((a: any, b: any) => num(b.companies_count) - num(a.companies_count))
            .slice(0, TOP_LABELS_COUNT)
            .forEach((r) => set.add(r.id));
        return set;
    }, [regions]);

    const [leadsByRegion, setLeadsByRegion] = useState<Record<number, LeadItem[]>>({});
    const leadsRef = useRef<Record<number, LeadItem[]>>({});
    const requestedRef = useRef<Set<number>>(new Set());
    const [mapHasSize, setMapHasSize] = useState(false);

    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showCompanies, setShowCompanies] = useState(true);
    const [showLegend, setShowLegend] = useState(true);
    const [activeTileKey, setActiveTileKey] = useState<'osm' | 'esri'>('osm');
    const [zoom, setZoom] = useState<number>(5);

    const fitAllRegions = useCallback(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const valid = regions.filter((r) => r.latitude && r.longitude);
        if (valid.length === 0) return;

        const bounds = L.latLngBounds(valid.map((r) => [r.latitude, r.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9, animate: true, duration: 1.0 });
    }, [regions]);

    // 1. Инициализация карты
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const container = mapContainerRef.current as HTMLElement & { _leaflet_id?: any };
        if (container._leaflet_id && !mapInstanceRef.current) {
            delete container._leaflet_id;
        }

        const timers: number[] = [];
        let disposed = false;

        const safeInvalidate = () => {
            const map = mapInstanceRef.current;
            if (disposed || !map || !container.isConnected) return;
            if (container.clientWidth === 0 || container.clientHeight === 0) return;
            map.invalidateSize();
            setMapHasSize(true);
        };

        if (!mapInstanceRef.current) {
            const map = L.map(container, {
                preferCanvas: true,
                center: [55.7539, 45.0],
                zoom: 5,
                zoomControl: false,
                attributionControl: true,
            });

            L.control.zoom({ position: 'topleft' }).addTo(map);

            const base = TILE_PROVIDERS.osm;
            tileLayerRef.current = L.tileLayer(base.url, {
                attribution: base.attribution,
                maxZoom: base.maxZoom,
                subdomains: base.subdomains,
            }).addTo(map);

            const gradient = {
                0.15: '#10b981',
                0.35: '#84cc16',
                0.55: '#facc15',
                0.75: '#fb923c',
                0.9: '#ef4444',
                1.0: '#991b1b',
            };

            mapInstanceRef.current = map;

            if (typeof (L as any).heatLayer === 'function') {
                const heat = (L as any).heatLayer([], {
                    radius: 28,
                    blur: 20,
                    maxZoom: 13,
                    max: 1.0,
                    minOpacity: 0.18,
                    gradient,
                });
                if (container.clientWidth > 0 && container.clientHeight > 0) heat.addTo(map);
                heatLayerRef.current = heat;
            }

            markersLayerRef.current = L.layerGroup().addTo(map);
            companyMarkersLayerRef.current = L.layerGroup().addTo(map);

            setZoom(Math.round(map.getZoom()));
            map.on('zoomend', () => {
                if (!disposed) setZoom(Math.round(map.getZoom()));
            });

            timers.push(window.setTimeout(safeInvalidate, 150));
            timers.push(window.setTimeout(safeInvalidate, 400));
        }

        const resizeObserver = new ResizeObserver(safeInvalidate);
        resizeObserver.observe(container);

        return () => {
            disposed = true;
            timers.forEach((t) => clearTimeout(t));
            resizeObserver.disconnect();

            const map = mapInstanceRef.current;
            const heat = heatLayerRef.current;
            if (map && heat && map.hasLayer(heat)) map.removeLayer(heat);
            heatLayerRef.current = null;

            if (map) {
                map.remove();
                mapInstanceRef.current = null;
            }
            tileLayerRef.current = null;
            markersLayerRef.current = null;
            companyMarkersLayerRef.current = null;
        };
    }, []);

    // 2. Смена подложки
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

        const p = TILE_PROVIDERS[activeTileKey];
        const layer = L.tileLayer(p.url, {
            attribution: p.attribution,
            maxZoom: p.maxZoom,
            subdomains: p.subdomains,
        }).addTo(map);
        layer.bringToBack();
        tileLayerRef.current = layer;
    }, [activeTileKey]);

    // 3. Тепловая карта
    useEffect(() => {
        const map = mapInstanceRef.current;
        const heat = heatLayerRef.current;
        if (!map || !heat) return;

        const el = mapContainerRef.current;
        const hasSize = !!el && el.clientWidth > 0 && el.clientHeight > 0;

        if (!showHeatmap) {
            if (map.hasLayer(heat)) map.removeLayer(heat);
            return;
        }
        if (!hasSize) return;

        if (!map.hasLayer(heat)) map.addLayer(heat);
        heat.setLatLngs(buildHeatPoints(regions, selectedRegion));
    }, [showHeatmap, selectedRegion, regions, mapHasSize]);

    // 4. Перелёт к выбранному региону / фильтру
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (selectedRegionDetail) {
            const lat = selectedRegionDetail.latitude;
            const lng = selectedRegionDetail.longitude;
            if (lat && lng) {
                map.flyTo([lat, lng], selectedRegionDetail.type === 'district' ? 12 : 11, { duration: 1.2 });
                const id = selectedRegionDetail.id;
                const t = window.setTimeout(() => markerLookupRef.current[id]?.openPopup(), 700);
                return () => clearTimeout(t);
            }
        }

        if (!selectedRegion || selectedRegion === 'Все регионы') {
            fitAllRegions();
            return;
        }

        const lower = selectedRegion.toLowerCase();

        if (lower.includes('москв')) {
            map.flyTo([55.7539, 37.6208], 10, { duration: 1.2 });
            return;
        }

        if (lower.includes('регионы рф')) {
            const outside = regions.filter(
                (r) => !['Москва', 'Химки', 'Мытищи'].includes(r.name) && r.latitude && r.longitude
            );
            if (outside.length > 0) {
                const bounds = L.latLngBounds(outside.map((r) => [r.latitude, r.longitude] as [number, number]));
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8, duration: 1.2 } as any);
            }
            return;
        }

        const match = regions.find(
            (r) => r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase())
        );
        if (match && match.latitude && match.longitude) {
            map.flyTo([match.latitude, match.longitude], match.type === 'district' ? 12 : 11, { duration: 1.2 });
            const id = match.id;
            const t = window.setTimeout(() => markerLookupRef.current[id]?.openPopup(), 700);
            return () => clearTimeout(t);
        }
    }, [selectedRegion, selectedRegionDetail, fitAllRegions, regions]);

    // 5. Маркеры регионов: круги на canvas + подписи по зуму
    useEffect(() => {
        const group = markersLayerRef.current;
        if (!group || !mapInstanceRef.current) return;

        group.clearLayers();
        markerLookupRef.current = {};

        // Сначала мелкие, затем крупные и выбранные — чтобы важное было сверху
        const sorted = [...regions]
            .filter((r) => r.latitude && r.longitude)
            .sort((a: any, b: any) => {
                const sa = selectedRegionDetail?.id === a.id ? 1 : 0;
                const sb = selectedRegionDetail?.id === b.id ? 1 : 0;
                if (sa !== sb) return sa - sb;
                return num(a.companies_count) - num(b.companies_count);
            });

        sorted.forEach((region: any) => {
            const isWhiteSpot = !!region.is_white_spot;
            const isSelected = selectedRegionDetail?.id === region.id;
            const hasCompanies = num(region.companies_count) > 0;
            const color = !hasCompanies ? COLOR_EMPTY : isWhiteSpot ? COLOR_WHITE_SPOT : COLOR_COVERED;

            const baseRadius = 5 + Math.min(11, Math.sqrt(num(region.companies_count)) * 0.7);
            const radius = isSelected ? baseRadius + 3 : baseRadius;

            const marker = L.circleMarker([region.latitude, region.longitude], {
                radius,
                color: isSelected ? '#111827' : '#ffffff',
                weight: isSelected ? 3 : 2,
                fillColor: color,
                fillOpacity: 0.85,
            }).addTo(group);

            markerLookupRef.current[region.id] = marker;

            // Подписи: все при большом зуме, топ-N при среднем, выбранный всегда
            const showLabel =
                isSelected || zoom >= ZOOM_LABELS_ALL || (zoom >= ZOOM_LABELS_TOP && topIds.has(region.id));

            const suffix = isWhiteSpot
                ? `<span style="color:${COLOR_WHITE_SPOT}"> ★ ${escapeHtml(region.priority_grade ?? '')}</span>`
                : `<span style="color:${COLOR_COVERED}"> ✓ ${escapeHtml(region.coverage_percent ?? 0)}%</span>`;

            marker.bindTooltip(`${escapeHtml(region.name)}${suffix}`, {
                permanent: showLabel,
                sticky: !showLabel,
                direction: 'right',
                offset: [radius + 2, 0],
                className: `gis-region-label${isSelected ? ' gis-region-label--selected' : ''}`,
                opacity: 1,
            });

            // Попап
            const formattedRevenue = new Intl.NumberFormat('ru-RU').format(num(region.revenue));
            const statusLabel = isWhiteSpot
                ? '<span style="color:#FF4F12;font-weight:bold;">⚠️ БЕЛОЕ ПЯТНО (Приоритет освоения)</span>'
                : '<span style="color:#7700FF;font-weight:bold;">✅ Покрыто контрактами РТК</span>';

            const popup = document.createElement('div');
            popup.style.fontFamily = 'var(--font-main)';
            popup.style.minWidth = '260px';
            popup.style.padding = '4px';
            popup.innerHTML = `
        <div style="border-bottom: 2px solid ${color}; padding-bottom: 6px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #111;">${escapeHtml(region.name)}</h4>
            <span style="font-size: 11px; font-weight: 700; color: ${color}; background: ${isWhiteSpot ? '#fff1ee' : '#f5f0ff'}; padding: 2px 6px; border-radius: 4px; white-space:nowrap;">
              Скоринг: ${escapeHtml(region.score ?? '—')}/100
            </span>
          </div>
          <span style="font-size: 11px; color: #6b7280;">${region.type === 'city' ? 'Город' : 'Муниципальный округ'} • Отрасль: ${escapeHtml(region.industry ?? '—')}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; margin-bottom: 12px; color: #374151;">
          <div><b>Статус:</b> ${statusLabel}</div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#6b7280;">Выручка рынка:</span><b>${formattedRevenue} ₽</b></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#6b7280;">Свободная емкость:</span><b style="color:#FF4F12;">~${escapeHtml(region.headroom_revenue_mln ?? 0)} млн ₽</b></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#6b7280;">Всего компаний (ЕГРЮЛ):</span><b>${escapeHtml(region.companies_count ?? 0)}</b></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#6b7280;">Действующие клиенты РТК:</span><b style="color:#7700FF;">${escapeHtml(region.clients_count ?? 0)} (${escapeHtml(region.coverage_percent ?? 0)}%)</b></div>
          <div style="display:flex; justify-content:space-between;"><span style="color:#6b7280;">Неохваченный потенциал:</span><b style="color:#FF4F12;">+${escapeHtml(region.potential_count ?? 0)} компаний</b></div>
        </div>
      `;

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '6px';

            const mkBtn = (label: string, solid: boolean, onClick: () => void) => {
                const b = document.createElement('button');
                b.innerHTML = label;
                b.style.flex = '1';
                b.style.padding = '6px 8px';
                b.style.fontSize = '12px';
                b.style.fontWeight = '600';
                b.style.borderRadius = '4px';
                b.style.cursor = 'pointer';
                b.style.color = solid ? '#fff' : COLOR_COVERED;
                b.style.background = solid ? color : '#f5f0ff';
                b.style.border = solid ? 'none' : `1px solid ${COLOR_COVERED}`;
                b.onclick = onClick;
                return b;
            };

            actions.appendChild(mkBtn('📋 Лиды', true, () => cbRef.current.onOpenCompanies?.(region)));
            actions.appendChild(
                mkBtn('📄 КП (.doc)', false, () => {
                    const leads = leadsRef.current[region.id] || [];
                    const topLead = leads.find((c) => !c.is_client) || leads[0];
                    if (topLead) generateCommercialOfferDoc(topLead as any);
                    else cbRef.current.onGenerateDoc?.(region);
                })
            );
            popup.appendChild(actions);

            marker.bindPopup(popup, { maxWidth: 300 });
            marker.on('click', () => cbRef.current.onSelectRegion?.(region));
        });
    }, [regions, selectedRegionDetail, zoom, topIds]);

    // 6a. Загрузка лидов (выбранный регион или топ-10 по числу компаний)
    useEffect(() => {
        if (!showCompanies || regions.length === 0) return;

        const targets: RegionItem[] = selectedRegionDetail
            ? [selectedRegionDetail]
            : [...regions]
                .sort((a: any, b: any) => num(b.companies_count) - num(a.companies_count))
                .slice(0, 10);

        let cancelled = false;
        targets.forEach((reg) => {
            if (!Number.isInteger(Number(reg.id))) return;
            if (requestedRef.current.has(reg.id)) return;
            requestedRef.current.add(reg.id);
            fetchRegionLeads(reg.id)
                .then((leads) => {
                    if (cancelled) return;
                    leadsRef.current = { ...leadsRef.current, [reg.id]: leads };
                    setLeadsByRegion(leadsRef.current);
                })
                .catch((e) => {
                    leadsRef.current = { ...leadsRef.current, [reg.id]: [] };
                    console.warn('Не удалось загрузить лиды региона', reg.id, e);
                });
        });

        return () => {
            cancelled = true;
        };
    }, [regions, showCompanies, selectedRegionDetail]);

    // 6b. Точки B2B-лидов (мелкие точки поверх районов, показываются от зума 8)
    useEffect(() => {
        const compGroup = companyMarkersLayerRef.current;
        if (!compGroup || !mapInstanceRef.current) return;

        compGroup.clearLayers();
        if (!showCompanies || zoom < 8) return;

        const fmt = new Intl.NumberFormat('ru-RU');

        Object.entries(leadsByRegion).forEach(([regionId, leads]) => {
            const reg = regions.find((r) => r.id === Number(regionId));
            if (!reg) return;

            leads.slice(0, MAX_LEAD_POINTS).forEach((company, idx) => {
                let lat = company.lat != null ? Number(company.lat) : null;
                let lng = company.lon != null ? Number(company.lon) : null;

                if ((lat == null || lng == null) && reg.latitude && reg.longitude) {
                    const angle = (idx * 1.37) % (2 * Math.PI);
                    const dist = 0.015 + ((idx * 7) % 25) * 0.002;
                    lat = reg.latitude + Math.sin(angle) * dist * 0.7;
                    lng = reg.longitude + Math.cos(angle) * dist * 1.1;
                }
                if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;

                const color = company.is_client ? COLOR_COVERED : COLOR_WHITE_SPOT;

                const m = L.circleMarker([lat, lng], {
                    radius: 3.5,
                    color: '#ffffff',
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 0.95,
                }).addTo(compGroup);

                m.bindTooltip(
                    `<b>${escapeHtml(company.name)}</b><br/><span style="font-size:11px; color:${color}">${
                        company.is_client ? '✅ Клиент РТК' : '⚠️ Потенциальный лид'
                    }</span><br/>Отрасль: ${escapeHtml(company.industry ?? '—')}<br/>Выручка: ${fmt.format(
                        company.revenue ?? 0
                    )} ₽`,
                    { direction: 'top', offset: [0, -6] }
                );
                m.on('click', () => cbRef.current.onOpenCompanies?.(reg));
            });
        });
    }, [leadsByRegion, regions, showCompanies, zoom]);

    const toolbarBtn = (active: boolean, bg: string, fg: string, border: string): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        background: active ? bg : '#ffffff',
        color: active ? fg : '#4b5563',
        border: `1.5px solid ${active ? border : '#e5e7eb'}`,
        borderRadius: '6px',
        padding: '6px 10px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    });

    return (
        <div
            id="radar-map-wrapper"
            style={{
                position: 'relative',
                width: '100%',
                height: '590px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                background: '#f8fafc',
            }}
        >
            <style>{LABEL_CSS}</style>

            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Панель слоёв */}
            <div
                style={{
                    position: 'absolute',
                    top: '14px',
                    left: '60px',
                    display: 'flex',
                    gap: '6px',
                    zIndex: 1000,
                    flexWrap: 'wrap',
                    maxWidth: 'calc(100% - 330px)',
                }}
            >
                <button
                    type="button"
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    style={toolbarBtn(showHeatmap, '#fff1ee', COLOR_WHITE_SPOT, COLOR_WHITE_SPOT)}
                    title="Включить / выключить тепловую карту плотности спроса"
                >
                    <Flame size={14} color={showHeatmap ? COLOR_WHITE_SPOT : '#6b7280'} />
                    <span>Тепловая карта</span>
                </button>

                <button
                    type="button"
                    onClick={() => setShowCompanies(!showCompanies)}
                    style={toolbarBtn(showCompanies, '#f5f0ff', COLOR_COVERED, COLOR_COVERED)}
                    title="Показывать точки целевых компаний B2B на карте (от масштаба 8)"
                >
                    <Building2 size={14} color={showCompanies ? COLOR_COVERED : '#6b7280'} />
                    <span>Точки B2B лидов</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTileKey(activeTileKey === 'osm' ? 'esri' : 'osm')}
                    style={toolbarBtn(false, '#fff', '#374151', '#e5e7eb')}
                    title="Переключить стиль подложки карты"
                >
                    <Layers size={14} color="#6b7280" />
                    <span>Слой: {activeTileKey === 'osm' ? 'Стандартный (OSM)' : 'Светлый (Esri)'}</span>
                </button>

                <button
                    type="button"
                    onClick={fitAllRegions}
                    style={toolbarBtn(false, '#fff', '#374151', '#e5e7eb')}
                    title="Сбросить масштаб и показать все регионы"
                >
                    <Maximize2 size={13} color="#6b7280" />
                    <span>Вся РФ</span>
                </button>
            </div>

            {/* Легенда */}
            <div
                style={{
                    position: 'absolute',
                    top: '14px',
                    right: '14px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.14)',
                    padding: '12px 14px',
                    width: '230px',
                    zIndex: 1000,
                    border: '1px solid #f3f4f6',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>Концентрация рынка</span>
                    <button
                        type="button"
                        onClick={() => setShowLegend(!showLegend)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, fontSize: '12px' }}
                        title="Свернуть / развернуть легенду"
                    >
                        {showLegend ? '▼' : '▲'}
                    </button>
                </div>

                <div
                    style={{
                        height: '8px',
                        borderRadius: '4px',
                        background:
                            'linear-gradient(to right, #10b981 0%, #84cc16 25%, #facc15 50%, #fb923c 75%, #ef4444 90%, #991b1b 100%)',
                        marginBottom: '4px',
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#6b7280', marginBottom: '8px' }}>
                    <span>Низкая плотность</span>
                    <span>Ядро спроса</span>
                </div>

                {showLegend && (
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                        <LegendRow color={COLOR_WHITE_SPOT} size={10}>
                            <b>Белое пятно</b> (высокий потенциал, &lt;5% клиентов)
                        </LegendRow>
                        <LegendRow color={COLOR_COVERED} size={10}>
                            <b>Покрытый регион</b> (действующие договоры РТК)
                        </LegendRow>
                        <LegendRow color={COLOR_EMPTY} size={10}>
                            <b>Нет данных</b> (компаний не найдено)
                        </LegendRow>
                        <div style={{ color: '#6b7280', fontSize: '10.5px' }}>
                            Размер круга — число компаний. Подписи: масштаб 8+ — топ-{TOP_LABELS_COUNT}, 10+ — все.
                        </div>
                        {showCompanies && (
                            <LegendRow color={COLOR_WHITE_SPOT} size={6}>
                                <span style={{ color: '#6b7280' }}>Точки компаний B2B (масштаб 8+, клик для деталей)</span>
                            </LegendRow>
                        )}
                    </div>
                )}
            </div>

            {/* Подсказка */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255, 255, 255, 0.92)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: '20px',
                    padding: '4px 14px',
                    fontSize: '11.5px',
                    color: '#4b5563',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                    zIndex: 999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    pointerEvents: 'none',
                }}
            >
                <MapPin size={13} color={COLOR_WHITE_SPOT} />
                <span>Кликните на круг региона или строку таблицы для центрирования и формирования КП</span>
            </div>
        </div>
    );
};

const LegendRow: React.FC<{ color: string; size: number; children: React.ReactNode }> = ({ color, size, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: color,
                border: '1px solid #fff',
                display: 'inline-block',
                flexShrink: 0,
            }}
        />
        <span style={{ color: '#374151' }}>{children}</span>
    </div>
);
