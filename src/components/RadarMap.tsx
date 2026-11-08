import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure global Leaflet is present for plugins
if (typeof window !== 'undefined' && !(window as any).L) {
  (window as any).L = L;
}
import 'leaflet.heat';

import { RegionItem, CompanyItem, INITIAL_COMPANIES } from '../data/mockData';
import { getPointsForRegionFilter } from '../data/moscowHeatmapData';
import { generateCommercialOfferDoc } from '../utils/docGenerator';
import {
  Layers,
  Flame,
  Building2,
  Maximize2,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface RadarMapProps {
  regions: RegionItem[];
  selectedRegion?: string;
  selectedRegionDetail?: RegionItem | null;
  onSelectRegion?: (region: RegionItem) => void;
  onOpenCompanies?: (region: RegionItem | null) => void;
  onGenerateDoc?: (companyOrRegion: any) => void;
}

// Available basemaps (100% free, no API keys required, no watermarks)
const TILE_PROVIDERS = {
  osm: {
    name: 'OpenStreetMap (Стандартная)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ПАО «Ростелеком»',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  esri: {
    name: 'Светлая подложка (Esri Light Gray)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | ПАО «Ростелеком»',
    maxZoom: 16,
    subdomains: [],
  },
};

export const RadarMap: React.FC<RadarMapProps> = ({
  regions,
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
  const markerLookupRef = useRef<Record<number, L.Marker>>({});

  // Layer toggles state
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCompanies, setShowCompanies] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [activeTileKey, setActiveTileKey] = useState<'osm' | 'esri'>('osm');
  const [currentZoom, setCurrentZoom] = useState<number>(5);

  // Helper: Fit bounds to all regions in Russia or selected subset
  const fitAllRegions = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || regions.length === 0) return;

    const validRegions = regions.filter((r) => r.latitude && r.longitude);
    if (validRegions.length === 0) return;

    const bounds = L.latLngBounds(validRegions.map((r) => [r.latitude, r.longitude]));
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 9,
      animate: true,
      duration: 1.0,
    });
  }, [regions]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix potential React 18/19 StrictMode double initialization
    const container = mapContainerRef.current as HTMLElement & { _leaflet_id?: any };
    if (container._leaflet_id && !mapInstanceRef.current) {
      delete container._leaflet_id;
    }

    if (!mapInstanceRef.current) {
      // Default center: Moscow & European Russia view
      const map = L.map(container, {
        center: [55.7539, 45.0],
        zoom: 5,
        zoomControl: false, // We render clean zoom controls
        attributionControl: true,
      });

      // Add Zoom control at top-left with sleek styling
      L.control
        .zoom({
          position: 'topleft',
        })
        .addTo(map);

      // Add base tile layer
      const baseProvider = TILE_PROVIDERS[activeTileKey];
      const tileLayer = L.tileLayer(baseProvider.url, {
        attribution: baseProvider.attribution,
        maxZoom: baseProvider.maxZoom,
        subdomains: baseProvider.subdomains,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Heatmap gradient
      const gradient = {
        0.15: '#10b981', // Green
        0.35: '#84cc16', // Lime green
        0.55: '#facc15', // Yellow
        0.75: '#fb923c', // Orange
        0.90: '#ef4444', // Red
        1.0: '#991b1b',  // Dark Crimson Core
      };

      // Initial heat layer with multi-region points
      const initialPoints = getPointsForRegionFilter(selectedRegion);
      if (typeof (L as any).heatLayer === 'function') {
        const heat = (L as any).heatLayer(initialPoints, {
          radius: 28,
          blur: 20,
          maxZoom: 13,
          max: 1.0,
          minOpacity: 0.18,
          gradient,
        }).addTo(map);
        heatLayerRef.current = heat;
      }

      // Layer groups for markers
      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;

      const companyGroup = L.layerGroup().addTo(map);
      companyMarkersLayerRef.current = companyGroup;

      // Track zoom level for dynamic level-of-detail
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      mapInstanceRef.current = map;

      // Fix initial grey tile issue: invalidate size after render
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
      setTimeout(() => {
        map.invalidateSize();
      }, 400);
    }

    // ResizeObserver to handle tab switches and container resizing
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Switch Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const provider = TILE_PROVIDERS[activeTileKey];
    const newLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
      subdomains: provider.subdomains,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [activeTileKey]);

  // 3. Toggle Heatmap Visibility & Points
  useEffect(() => {
    const map = mapInstanceRef.current;
    const heat = heatLayerRef.current;
    if (!map || !heat) return;

    if (!showHeatmap) {
      if (map.hasLayer(heat)) {
        map.removeLayer(heat);
      }
      return;
    }

    if (!map.hasLayer(heat)) {
      map.addLayer(heat);
    }

    const updatedPoints = getPointsForRegionFilter(selectedRegion);
    heat.setLatLngs(updatedPoints);
  }, [showHeatmap, selectedRegion]);

  // 4. Region Fly-to when selectedRegion filter or selectedRegionDetail changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Case A: specific Region Detail is chosen
    if (selectedRegionDetail) {
      const lat = selectedRegionDetail.latitude;
      const lng = selectedRegionDetail.longitude;
      if (lat && lng) {
        map.flyTo([lat, lng], selectedRegionDetail.type === 'district' ? 12 : 11, {
          duration: 1.2,
        });

        // Open popup for this marker if rendered
        const marker = markerLookupRef.current[selectedRegionDetail.id];
        if (marker) {
          setTimeout(() => {
            marker.openPopup();
          }, 600);
        }
        return;
      }
    }

    // Case B: Filter selection
    if (!selectedRegion || selectedRegion === 'Все регионы') {
      fitAllRegions();
      return;
    }

    const lower = selectedRegion.toLowerCase();
    if (lower.includes('москв') || lower.includes('мо')) {
      map.flyTo([55.7539, 37.6208], 10, { duration: 1.2 });
      return;
    }

    if (lower.includes('регионы рф')) {
      const outsideMoscow = regions.filter(
        (r) => !['Москва', 'Химки', 'Мытищи'].includes(r.name) && r.latitude && r.longitude
      );
      if (outsideMoscow.length > 0) {
        const bounds = L.latLngBounds(outsideMoscow.map((r) => [r.latitude, r.longitude]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8, duration: 1.2 });
      }
      return;
    }

    // Look for matching region
    const match = regions.find(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        lower.includes(r.name.toLowerCase())
    );

    if (match && match.latitude && match.longitude) {
      map.flyTo([match.latitude, match.longitude], match.type === 'district' ? 12 : 11, {
        duration: 1.2,
      });
      const marker = markerLookupRef.current[match.id];
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 600);
      }
    }
  }, [selectedRegion, selectedRegionDetail, fitAllRegions, regions]);

  // 5. Render Region Markers with Badges & Popups
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup || !mapInstanceRef.current) return;

    markersGroup.clearLayers();
    markerLookupRef.current = {};

    regions.forEach((region) => {
      const lat = region.latitude ?? 55.751244;
      const lng = region.longitude ?? 37.618423;
      const isWhiteSpot = region.is_white_spot;
      const isSelected = selectedRegionDetail?.id === region.id;

      const primaryColor = isWhiteSpot ? '#FF4F12' : '#7700FF';
      const badgeBorder = isSelected ? `2.5px solid ${primaryColor}` : `1.5px solid ${primaryColor}`;
      const badgeShadow = isSelected
        ? `0 0 0 4px ${isWhiteSpot ? 'rgba(255, 79, 18, 0.35)' : 'rgba(119, 0, 255, 0.35)'}, 0 6px 18px rgba(0,0,0,0.25)`
        : '0 2px 8px rgba(0,0,0,0.18)';

      // Position offset when zoomed out to prevent Moscow / Khimki / Mytishchi label collision
      let labelTransform = 'translate(-50%, -50%)';
      if (currentZoom < 9) {
        if (region.name === 'Химки') {
          labelTransform = 'translate(-102%, -115%)';
        } else if (region.name === 'Мытищи') {
          labelTransform = 'translate(2%, -115%)';
        } else if (region.name === 'Москва') {
          labelTransform = 'translate(-50%, 45%)';
        }
      }

      const markerHtml = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.96);
          border: ${badgeBorder};
          padding: 4px 10px;
          border-radius: 16px;
          box-shadow: ${badgeShadow};
          font-family: var(--font-main);
          font-size: 11.5px;
          font-weight: 700;
          color: #111827;
          cursor: pointer;
          white-space: nowrap;
          transform: ${labelTransform};
          transition: all 0.2s ease;
        ">
          <span style="
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: ${primaryColor};
            display: inline-block;
            box-shadow: 0 0 6px ${primaryColor};
          "></span>
          <span>${region.name}</span>
          ${
            isWhiteSpot
              ? `<span style="background: #FF4F12; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 8px;">★ ${region.priority_grade}</span>`
              : `<span style="background: #e9d5ff; color: #7700FF; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 8px;">✓ ${region.coverage_percent}%</span>`
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'gis-region-badge',
        html: markerHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : isWhiteSpot ? 500 : 100,
      }).addTo(markersGroup);

      markerLookupRef.current[region.id] = marker;

      // Popup Content
      const formattedRevenue = new Intl.NumberFormat('ru-RU').format(region.revenue);
      const statusLabel = isWhiteSpot
        ? '<span style="color:#FF4F12;font-weight:bold;display:inline-flex;align-items:center;gap:4px;">⚠️ БЕЛОЕ ПЯТНО (Приоритет освоения)</span>'
        : '<span style="color:#7700FF;font-weight:bold;display:inline-flex;align-items:center;gap:4px;">✅ Покрыто контрактами РТК</span>';

      const popupContainer = document.createElement('div');
      popupContainer.style.fontFamily = 'var(--font-main)';
      popupContainer.style.minWidth = '260px';
      popupContainer.style.padding = '4px';

      popupContainer.innerHTML = `
        <div style="border-bottom: 2px solid ${primaryColor}; padding-bottom: 6px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #111;">${region.name}</h4>
            <span style="font-size: 11px; font-weight: 700; color: ${primaryColor}; background: ${isWhiteSpot ? '#fff1ee' : '#f5f0ff'}; padding: 2px 6px; border-radius: 4px;">
              Скоринг: ${region.score}/100
            </span>
          </div>
          <span style="font-size: 11px; color: #6b7280;">${region.type === 'city' ? 'Город' : 'Муниципальный округ'} • Отрасль: ${region.industry}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; margin-bottom: 12px; color: #374151;">
          <div><b>Статус:</b> ${statusLabel}</div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Выручка рынка:</span>
            <b>${formattedRevenue} ₽</b>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Свободная емкость:</span>
            <b style="color: #FF4F12;">~${region.headroom_revenue_mln} млн ₽</b>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Всего компаний (ЕГРЮЛ):</span>
            <b>${region.companies_count}</b>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Действующие клиенты РТК:</span>
            <b style="color: #7700FF;">${region.clients_count} (${region.coverage_percent}%)</b>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Неохваченный потенциал:</span>
            <b style="color: #FF4F12;">+${region.potential_count} компаний</b>
          </div>
        </div>
      `;

      // Buttons inside popup
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '6px';

      const btnLeads = document.createElement('button');
      btnLeads.innerHTML = '📋 Лиды';
      btnLeads.style.flex = '1';
      btnLeads.style.padding = '6px 8px';
      btnLeads.style.fontSize = '12px';
      btnLeads.style.fontWeight = '600';
      btnLeads.style.color = '#fff';
      btnLeads.style.background = primaryColor;
      btnLeads.style.border = 'none';
      btnLeads.style.borderRadius = '4px';
      btnLeads.style.cursor = 'pointer';
      btnLeads.onclick = () => {
        if (onOpenCompanies) onOpenCompanies(region);
      };
      actionsDiv.appendChild(btnLeads);

      const btnDoc = document.createElement('button');
      btnDoc.innerHTML = '📄 КП (.doc)';
      btnDoc.style.flex = '1';
      btnDoc.style.padding = '6px 8px';
      btnDoc.style.fontSize = '12px';
      btnDoc.style.fontWeight = '600';
      btnDoc.style.color = '#7700FF';
      btnDoc.style.background = '#f5f0ff';
      btnDoc.style.border = '1px solid #7700FF';
      btnDoc.style.borderRadius = '4px';
      btnDoc.style.cursor = 'pointer';
      btnDoc.onclick = () => {
        const topLead = INITIAL_COMPANIES.find((c) => c.region_id === region.id && !c.is_client) ||
          INITIAL_COMPANIES.find((c) => c.region_id === region.id);
        if (topLead) {
          generateCommercialOfferDoc(topLead);
        } else if (onGenerateDoc) {
          onGenerateDoc(region);
        }
      };
      actionsDiv.appendChild(btnDoc);

      popupContainer.appendChild(actionsDiv);
      marker.bindPopup(popupContainer, { maxWidth: 300 });

      marker.on('click', () => {
        if (onSelectRegion) onSelectRegion(region);
      });
    });
  }, [regions, selectedRegionDetail, currentZoom, onSelectRegion, onOpenCompanies, onGenerateDoc]);

  // 6. Render B2B Company Leads Points (when enabled or zoomed in)
  useEffect(() => {
    const compGroup = companyMarkersLayerRef.current;
    if (!compGroup || !mapInstanceRef.current) return;

    compGroup.clearLayers();
    if (!showCompanies) return;

    // Filter companies matching current region list
    const activeRegionIds = new Set(regions.map((r) => r.id));
    const companiesToRender = INITIAL_COMPANIES.filter((c) => activeRegionIds.has(c.region_id));

    // Jitter companies around region centers deterministically
    companiesToRender.forEach((company, idx) => {
      const reg = regions.find((r) => r.id === company.region_id);
      if (!reg || !reg.latitude || !reg.longitude) return;

      // Deterministic angle & offset around region center
      const angle = (idx * 1.37) % (2 * Math.PI);
      const dist = 0.015 + ((idx * 7) % 25) * 0.002;
      const lat = reg.latitude + Math.sin(angle) * dist * 0.7;
      const lng = reg.longitude + Math.cos(angle) * dist * 1.1;

      const isClient = company.is_client;
      const color = isClient ? '#7700FF' : '#FF4F12';

      const compMarkerHtml = `
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          cursor: pointer;
          transform: translate(-50%, -50%);
        "></div>
      `;

      const compIcon = L.divIcon({
        className: 'company-pin-marker',
        html: compMarkerHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon: compIcon }).addTo(compGroup);

      // Tooltip on hover
      marker.bindTooltip(
        `<b>${company.name}</b><br/><span style="font-size:11px; color:${color}">${isClient ? '✅ Клиент РТК' : '⚠️ Потенциальный лид'}</span><br/>Потенциал сделки: ${new Intl.NumberFormat('ru-RU').format(company.potential_deal_rub)} ₽/мес`,
        { direction: 'top', offset: [0, -8] }
      );

      marker.on('click', () => {
        if (onOpenCompanies) {
          onOpenCompanies(reg);
        }
      });
    });
  }, [regions, showCompanies, onOpenCompanies]);

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
      {/* Full width Map Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* FLOATING TOP-LEFT TOOLBAR (Layers & Quick Controls) */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          left: '60px', // next to Leaflet zoom controls
          display: 'flex',
          gap: '6px',
          zIndex: 1000,
          flexWrap: 'wrap',
        }}
      >
        {/* Toggle Heatmap */}
        <button
          type="button"
          onClick={() => setShowHeatmap(!showHeatmap)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: showHeatmap ? '#fff1ee' : '#ffffff',
            color: showHeatmap ? '#FF4F12' : '#4b5563',
            border: `1.5px solid ${showHeatmap ? '#FF4F12' : '#e5e7eb'}`,
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
          title="Включить / выключить тепловую карту плотности спроса"
        >
          <Flame size={14} color={showHeatmap ? '#FF4F12' : '#6b7280'} />
          <span>Тепловая карта</span>
        </button>

        {/* Toggle B2B Leads */}
        <button
          type="button"
          onClick={() => setShowCompanies(!showCompanies)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: showCompanies ? '#f5f0ff' : '#ffffff',
            color: showCompanies ? '#7700FF' : '#4b5563',
            border: `1.5px solid ${showCompanies ? '#7700FF' : '#e5e7eb'}`,
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
          title="Показывать точки целевых компаний B2B на карте"
        >
          <Building2 size={14} color={showCompanies ? '#7700FF' : '#6b7280'} />
          <span>Точки B2B лидов</span>
        </button>

        {/* Switch Tile Provider */}
        <button
          type="button"
          onClick={() => setActiveTileKey(activeTileKey === 'osm' ? 'esri' : 'osm')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#ffffff',
            color: '#374151',
            border: '1.5px solid #e5e7eb',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
          title="Переключить стиль подложки карты"
        >
          <Layers size={14} color="#6b7280" />
          <span>Слой: {activeTileKey === 'osm' ? 'Стандартный (OSM)' : 'Светлый (Esri)'}</span>
        </button>

        {/* Reset View Button */}
        <button
          type="button"
          onClick={fitAllRegions}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#ffffff',
            color: '#374151',
            border: '1.5px solid #e5e7eb',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
          title="Сбросить масштаб и показать все регионы РФ"
        >
          <Maximize2 size={13} color="#6b7280" />
          <span>Вся РФ</span>
        </button>
      </div>

      {/* FLOATING TOP-RIGHT LEGEND CARD (Exactly matching Rostelecom GIS specs) */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>
              Концентрация рынка
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: 0,
              fontSize: '12px',
            }}
            title="Свернуть / развернуть легенду"
          >
            {showLegend ? '▼' : '▲'}
          </button>
        </div>

        {/* Continuous Gradient Bar */}
        <div
          style={{
            height: '8px',
            borderRadius: '4px',
            background: 'linear-gradient(to right, #10b981 0%, #84cc16 25%, #facc15 50%, #fb923c 75%, #ef4444 90%, #991b1b 100%)',
            marginBottom: '4px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#6b7280', marginBottom: '8px' }}>
          <span>Низкая плотность</span>
          <span>Ядро спроса</span>
        </div>

        {showLegend && (
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF4F12', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#374151' }}>
                <b>Белое пятно</b> (Высокий потенциал, &lt;5% клиентов)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7700FF', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#374151' }}>
                <b>Покрытый регион</b> (Действующие договоры РТК)
              </span>
            </div>
            {showCompanies && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF4F12', border: '1px solid #fff', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: '#6b7280' }}>Точки компаний B2B (клик для деталей)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Center Helper Banner */}
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
        <MapPin size={13} color="#FF4F12" />
        <span>Кликните на маркер региона или строку таблицы для центрирования и формирования КП</span>
      </div>
    </div>
  );
};
