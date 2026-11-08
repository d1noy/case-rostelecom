import React, { useMemo, useState } from 'react';
import type { RegionItem } from '../data/mockData';

interface FiltersProps {
    selectedRegion: string;
    onRegionChange: (val: string) => void;
    selectedIndustry: string;
    onIndustryChange: (val: string) => void;
    revenueFilter: string;
    onRevenueChange: (val: string) => void;
    growthFilter: string;
    onGrowthChange: (val: string) => void;
    onApply: () => void;
    regionsToExport: RegionItem[];
    /** Полный (не отфильтрованный) список регионов из API — источник для выпадающего списка */
    regions?: RegionItem[];
    onOpenLeadsRegistry: () => void;
}

export const Filters: React.FC<FiltersProps> = ({
                                                    selectedRegion,
                                                    onRegionChange,
                                                    selectedIndustry,
                                                    onIndustryChange,
                                                    revenueFilter,
                                                    onRevenueChange,
                                                    growthFilter,
                                                    onGrowthChange,
                                                    onApply,
                                                    regionsToExport,
                                                    regions,
                                                    onOpenLeadsRegistry,
                                                }) => {
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Список регионов строится из данных API (уникальные названия, по алфавиту)
    const regionOptions = useMemo(() => {
        const source = regions && regions.length > 0 ? regions : regionsToExport || [];
        const names = Array.from(
            new Set(source.map((r) => String(r.name ?? '').trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b, 'ru'));

        // Если выбранного значения нет в списке (например, после обновления данных) — оставляем его, чтобы select не «ломался»
        if (selectedRegion && selectedRegion !== 'Все регионы' && !names.includes(selectedRegion)) {
            names.unshift(selectedRegion);
        }
        return names;
    }, [regions, regionsToExport, selectedRegion]);

    // Standard Region CSV export via live backend
    const handleExportRegionsCsv = () => {
        const params = new URLSearchParams();
        if (selectedRegion && selectedRegion !== 'Все регионы') params.set('region', selectedRegion);
        if (selectedIndustry && selectedIndustry !== 'Все отрасли') params.set('industry', selectedIndustry);
        if (revenueFilter.trim()) params.set('revenue_min', revenueFilter.trim());
        if (growthFilter && growthFilter !== 'Любая') params.set('growth', growthFilter);

        const backendUrl = `/api/regions/export?${params.toString()}`;
        const link = document.createElement('a');
        link.href = backendUrl;
        link.setAttribute('download', `regions_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportMenuOpen(false);
    };

    // Full CRM Leads CSV Export via live backend
    const handleExportCrmLeadsCsv = () => {
        const params = new URLSearchParams();
        if (selectedRegion && selectedRegion !== 'Все регионы') params.set('region', selectedRegion);

        const backendUrl = `/api/companies/export?${params.toString()}`;
        const link = document.createElement('a');
        link.href = backendUrl;
        link.setAttribute('download', `crm_leads_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportMenuOpen(false);
    };

    return (
        <div className="filters" style={{ position: 'relative' }}>
            <div className="filter-group">
                <label>Регион</label>
                <select value={selectedRegion} onChange={(e) => onRegionChange(e.target.value)}>
                    <option value="Все регионы">Все регионы</option>
                    {regionOptions.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label>Отрасль</label>
                <select value={selectedIndustry} onChange={(e) => onIndustryChange(e.target.value)}>
                    <option value="Все отрасли">Все отрасли</option>
                    <option value="ТЭК">ТЭК</option>
                    <option value="Торговля и логистика">Торговля и логистика</option>
                    <option value="АПК и промышленность">АПК и промышленность</option>
                    <option value="Услуги населению">Услуги населению</option>
                    <option value="ИТ и связь">ИТ и связь</option>
                </select>
            </div>

            <div className="filter-group">
                <label>Выручка (млн ₽)</label>
                <input
                    type="text"
                    placeholder="от 0 до ∞"
                    value={revenueFilter}
                    onChange={(e) => onRevenueChange(e.target.value)}
                />
            </div>

            <div className="filter-group">
                <label>Динамика роста</label>
                <select value={growthFilter} onChange={(e) => onGrowthChange(e.target.value)}>
                    <option value="Любая">Любая</option>
                    <option value="Положительная">Положительная (рост &gt; 20%)</option>
                    <option value="Отрицательная">Умеренная / стабильная</option>
                </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn btn-primary" onClick={onApply}>
                    Применить
                </button>

                <button
                    type="button"
                    className="btn btn-outline"
                    style={{ borderColor: 'var(--rt-purple)', color: 'var(--rt-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={onOpenLeadsRegistry}
                >
                    📋 Реестр компаний и лидов
                </button>
            </div>

            {/* Export dropdown */}
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <button
                    type="button"
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                >
                    <span>📥 Экспорт данных</span>
                    <span style={{ fontSize: '10px' }}>▼</span>
                </button>

                {isExportMenuOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            background: '#fff',
                            borderRadius: '6px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            border: '1px solid #e5e7eb',
                            zIndex: 1050,
                            minWidth: '240px',
                            overflow: 'hidden',
                        }}
                    >
                        <button
                            type="button"
                            onClick={handleExportCrmLeadsCsv}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'block',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--rt-orange)' }}>Лиды для CRM (CSV)</div>
                            <div style={{ fontSize: '11px', color: '#666' }}>Выгрузка с ИНН, контактами и потенциалом</div>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportRegionsCsv}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                display: 'block',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--rt-dark)' }}>Сводка по регионам (CSV)</div>
                            <div style={{ fontSize: '11px', color: '#666' }}>Аналитические показатели по районам</div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
