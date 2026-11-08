import React, { useState, useMemo, useEffect } from 'react';
import { CompanyItem, RegionItem } from '../data/mockData';
import { generateCommercialOfferDoc } from '../utils/docGenerator';
import { FileText, ShieldCheck, Download, Search, CheckCircle2 } from 'lucide-react';

interface CompaniesListModalProps {
    region: RegionItem | null;
    onClose: () => void;
}

// Форма компании, как её отдаёт GET /api/companies
interface ApiCompany {
    id: number;
    region_id: number;
    name: string;
    inn: string | number;
    city: string;
    industry: string;
    revenue: number;
    employees: number;
    is_client: boolean;
    fns_risk_level?: string;
    procurement_type?: string;
    msp_registry?: string;
    recommended_service?: string;
    potential_deal_rub: number;
}

const authHeaders = (): Record<string, string> => ({
    Authorization: 'Bearer ' + (localStorage.getItem('access_token') ?? ''),
    Accept: 'application/json',
});

export const CompaniesListModal: React.FC<CompaniesListModalProps> = ({
                                                                          region,
                                                                          onClose,
                                                                      }) => {
    const [filterType, setFilterType] = useState<'all' | 'leads' | 'clients'>('all');
    const [search, setSearch] = useState('');
    const [allCompanies, setAllCompanies] = useState<ApiCompany[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Грузим компании региона один раз; статус и поиск фильтруем на клиенте,
    // чтобы счётчики в кнопках считались по реальным данным API.
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (region?.id) params.set('region_id', String(region.id));

        fetch('/api/companies?' + params.toString(), { headers: authHeaders() })
            .then((res) => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then((json: ApiCompany[] | { data: ApiCompany[] }) => {
                if (!isMounted) return;
                const list = Array.isArray(json) ? json : json.data;
                setAllCompanies(Array.isArray(list) ? list : []);
            })
            .catch((err) => {
                if (!isMounted) return;
                console.error('Не удалось загрузить компании:', err);
                setAllCompanies([]);
                setError('Не удалось загрузить данные. Проверьте авторизацию и соединение с сервером.');
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [region?.id]);

    const counts = useMemo(
        () => ({
            all: allCompanies.length,
            leads: allCompanies.filter((c) => !c.is_client).length,
            clients: allCompanies.filter((c) => c.is_client).length,
        }),
        [allCompanies]
    );

    const companies = useMemo(() => {
        let list = allCompanies;
        if (filterType === 'leads') list = list.filter((c) => !c.is_client);
        if (filterType === 'clients') list = list.filter((c) => c.is_client);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (c) =>
                    String(c.name ?? '').toLowerCase().includes(q) ||
                    String(c.inn ?? '').includes(q)
            );
        }
        return list;
    }, [allCompanies, filterType, search]);

    // Экспорт через fetch с токеном: обычная ссылка <a download> токен не отправляет
    const handleExportCrmCsv = async () => {
        try {
            const params = new URLSearchParams();
            if (region?.id) params.set('region_id', String(region.id));
            if (filterType !== 'all') params.set('status', filterType);
            if (search.trim()) params.set('q', search.trim());

            const res = await fetch('/api/companies/export?' + params.toString(), {
                headers: { ...authHeaders(), Accept: 'text/csv' },
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const regionName = region ? region.name : 'all';
            const dateStr = new Date().toISOString().slice(0, 10);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'crm_leads_' + regionName + '_' + dateStr + '.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Ошибка экспорта CSV:', err);
            setError('Не удалось выгрузить CSV. Проверьте авторизацию.');
        }
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
                            className={'btn ' + (filterType === 'all' ? 'btn-primary' : 'btn-outline')}
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                            onClick={() => setFilterType('all')}
                        >
                            Все компании ({counts.all})
                        </button>
                        <button
                            type="button"
                            className={'btn ' + (filterType === 'leads' ? 'btn-primary' : 'btn-outline')}
                            style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                borderColor: 'var(--rt-orange)',
                                color: filterType === 'leads' ? '#fff' : 'var(--rt-orange)',
                                background: filterType === 'leads' ? 'var(--rt-orange)' : 'transparent',
                            }}
                            onClick={() => setFilterType('leads')}
                        >
                            🎯 Потенциальные лиды ({counts.leads})
                        </button>
                        <button
                            type="button"
                            className={'btn ' + (filterType === 'clients' ? 'btn-primary' : 'btn-outline')}
                            style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                borderColor: 'var(--rt-purple)',
                                color: filterType === 'clients' ? '#fff' : 'var(--rt-purple)',
                                background: filterType === 'clients' ? 'var(--rt-purple)' : 'transparent',
                            }}
                            onClick={() => setFilterType('clients')}
                        >
                            ✅ Действующие клиенты ({counts.clients})
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

                {error && (
                    <div
                        style={{
                            padding: '10px 24px',
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontSize: '13px',
                            borderBottom: '1px solid #fecaca',
                        }}
                    >
                        {error}
                    </div>
                )}

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
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                                    Загрузка...
                                </td>
                            </tr>
                        ) : companies.length === 0 ? (
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
                          ФНС: Риск {(c.fns_risk_level ?? '—').toLowerCase()}
                        </span>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                          <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#4b5563', padding: '1px 5px', borderRadius: '3px', border: '1px solid #e5e7eb' }}>
                            {c.procurement_type ?? '—'}
                          </span>
                                                <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', padding: '1px 5px', borderRadius: '3px', border: '1px solid #dbeafe' }}>
                            {c.msp_registry ?? '—'}
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
                                        {c.recommended_service ?? '—'}
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
                                            onClick={() => generateCommercialOfferDoc(c as unknown as CompanyItem)}
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
