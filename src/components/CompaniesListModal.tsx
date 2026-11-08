import React, { useState, useMemo, useEffect } from 'react';
import { CompanyItem, RegionItem, INITIAL_COMPANIES } from '../data/mockData';
import { generateCommercialOfferDoc } from '../utils/docGenerator';
import { FileText, ShieldCheck, Download, Search, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { authService } from '../services/authService';

interface CompaniesListModalProps {
  region: RegionItem | null;
  onClose: () => void;
}

export const CompaniesListModal: React.FC<CompaniesListModalProps> = ({
  region,
  onClose,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'leads' | 'clients'>('all');
  const [search, setSearch] = useState('');
  const [apiCompanies, setApiCompanies] = useState<CompanyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch real leads from API
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const params = new URLSearchParams();
    if (region?.id) params.set('region_id', String(region.id));
    if (filterType !== 'all') params.set('status', filterType);
    if (search.trim()) params.set('q', search.trim());

    authService
      .apiFetch(`/api/companies?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('API request failed');
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        const list = Array.isArray(json) ? json : json.data;
        if (Array.isArray(list)) {
          setApiCompanies(list);
        }
      })
      .catch((err) => {
        console.warn('Fallback to local companies:', err);
        // Fallback filter
        let list = INITIAL_COMPANIES;
        if (region) {
          list = list.filter((c) => c.region_id === region.id);
        }
        if (filterType === 'leads') {
          list = list.filter((c) => !c.is_client);
        } else if (filterType === 'clients') {
          list = list.filter((c) => c.is_client);
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          list = list.filter((c) => c.name.toLowerCase().includes(q) || c.inn.includes(q));
        }
        setApiCompanies(list);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [region, filterType, search]);

  const companies = apiCompanies;

  const handleExportCrmCsv = () => {
    const params = new URLSearchParams();
    if (region?.id) params.set('region_id', String(region.id));
    if (filterType !== 'all') params.set('status', filterType);
    if (search.trim()) params.set('q', search.trim());

    const backendUrl = `/api/companies/export?${params.toString()}`;
    const link = document.createElement('a');
    link.href = backendUrl;
    link.setAttribute('download', `crm_leads_${region ? region.name : 'all'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '1150px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fafafa',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--rt-dark)' }}>
                Реестр предприятий: {region ? region.name : 'Все регионы'}
              </h3>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  border: '1px solid #a7f3d0',
                }}
              >
                <ShieldCheck size={13} color="#059669" />
                Верифицировано ФНС / ЕГРЮЛ
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: '4px 0 0' }}>
              Индикация действующих контрактов, открытых реестров и генерация КП в формате DOC
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            padding: '12px 24px',
            background: '#fff',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setFilterType('all')}
            >
              Все компании ({INITIAL_COMPANIES.filter((c) => !region || c.region_id === region.id).length})
            </button>
            <button
              type="button"
              className={`btn ${filterType === 'leads' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderColor: 'var(--rt-orange)',
                color: filterType === 'leads' ? '#fff' : 'var(--rt-orange)',
                background: filterType === 'leads' ? 'var(--rt-orange)' : 'transparent',
              }}
              onClick={() => setFilterType('leads')}
            >
              🎯 Потенциальные лиды ({INITIAL_COMPANIES.filter((c) => (!region || c.region_id === region.id) && !c.is_client).length})
            </button>
            <button
              type="button"
              className={`btn ${filterType === 'clients' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderColor: 'var(--rt-purple)',
                color: filterType === 'clients' ? '#fff' : 'var(--rt-purple)',
                background: filterType === 'clients' ? 'var(--rt-purple)' : 'transparent',
              }}
              onClick={() => setFilterType('clients')}
            >
              ✅ Действующие клиенты ({INITIAL_COMPANIES.filter((c) => (!region || c.region_id === region.id) && c.is_client).length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Поиск по названию или ИНН..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '6px 12px 6px 30px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  width: '230px',
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#999' }} />
            </div>

            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--rt-dark)' }}
              onClick={handleExportCrmCsv}
              title="Выгрузить базу для Битрикс24 / amoCRM"
            >
              <Download size={14} />
              <span>Лиды CRM (CSV)</span>
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', color: 'var(--rt-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 8px' }}>Компания / ИНН</th>
                <th style={{ padding: '12px 8px' }}>Верификация данных</th>
                <th style={{ padding: '12px 8px' }}>Статус РТК</th>
                <th style={{ padding: '12px 8px' }}>Отрасль / Выручка</th>
                <th style={{ padding: '12px 8px' }}>Рекомендуемый сервис</th>
                <th style={{ padding: '12px 8px' }}>Прогноз MRR</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>КП (.doc)</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                    Компании не найдены. Измените параметры поиска или фильтра.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--rt-dark)' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--rt-muted)' }}>
                        ИНН: {c.inn} • г. {c.city}
                      </div>
                    </td>

                    {/* Open Data Badges */}
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '11px', color: '#047857', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                          <CheckCircle2 size={12} color="#10b981" />
                          ФНС: Риск {c.fns_risk_level.toLowerCase()}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#4b5563', padding: '1px 5px', borderRadius: '3px', border: '1px solid #e5e7eb' }}>
                            {c.procurement_type}
                          </span>
                          <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', padding: '1px 5px', borderRadius: '3px', border: '1px solid #dbeafe' }}>
                            {c.msp_registry}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      {c.is_client ? (
                        <span style={{ fontSize: '12px', background: 'rgba(119, 0, 255, 0.1)', color: 'var(--rt-purple)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Клиент РТК
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', background: 'rgba(255, 79, 18, 0.1)', color: 'var(--rt-orange)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Потенциальный лид
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ color: '#555' }}>{c.industry}</div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>
                        {new Intl.NumberFormat('ru-RU').format(c.revenue)} ₽ ({c.employees} сотр.)
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px', color: '#444' }}>
                      {c.recommended_service}
                    </td>

                    <td style={{ padding: '10px 8px', fontWeight: 600, color: c.is_client ? 'var(--rt-purple)' : 'var(--rt-orange)' }}>
                      ~{new Intl.NumberFormat('ru-RU').format(c.potential_deal_rub)} ₽/мес
                    </td>

                    {/* Generate DOC action */}
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderColor: '#7700FF',
                          color: '#7700FF',
                          background: '#faf5ff',
                        }}
                        onClick={() => generateCommercialOfferDoc(c)}
                        title="Скачать официальное коммерческое предложение в Word (.doc)"
                      >
                        <FileText size={13} />
                        <span>КП (.doc)</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
