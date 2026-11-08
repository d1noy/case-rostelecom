/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Filters } from './components/Filters';
import { RadarMap } from './components/RadarMap';
import { WhiteSpotsRecommendations } from './components/WhiteSpotsRecommendations';
import { CompaniesListModal } from './components/CompaniesListModal';
import { SalesEconomicsBanner } from './components/SalesEconomicsBanner';
import { TwoFactorSetupScreen } from './components/TwoFactorSetupScreen';
import { LoginModal } from './components/LoginModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { Footer } from './components/Footer';
import { RegionItem, INITIAL_COMPANIES } from './data/mockData';
import { generateCommercialOfferDoc } from './utils/docGenerator';
import { apiFetch, apiJson, getAccessToken, removeAccessToken, ApiError, getApiBaseUrl } from './api/client';
import { fetchCurrentUser, logout, UserProfile } from './api/auth';
import {
    FileText,
    ShieldCheck,
    CheckCircle2,
    RefreshCw,
    Lock,
    AlertTriangle,
    LogIn,
    Sliders,
    Radio,
} from 'lucide-react';
import InvestmentNavigator from "./components/InvestmentNavigator";
import DealCalculator from "./components/DealCalculator";

export default function App() {
    const [activeTab, setActiveTab] = useState<'radar' | 'navigator' | 'calculator'>('radar');

    // Authentication & 2FA State (Sanctum / Fortify)
    const [currentUser, setCurrentUser] = useState<string>('Иванов И.И.');
    const [currentUserEmail, setCurrentUserEmail] = useState<string>('ivanov@rt.ru');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
    const [isTwoFactorConfirmed, setIsTwoFactorConfirmed] = useState<boolean>(true);
    const [isTwoFactorBlocked, setIsTwoFactorBlocked] = useState<boolean>(false);

    // Modals state
    const [show2FAModal, setShow2FAModal] = useState<boolean>(false);
    const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
    const [showApiSettingsModal, setShowApiSettingsModal] = useState<boolean>(false);

    // Filters state
    const [selectedRegion, setSelectedRegion] = useState<string>('Все регионы');
    const [selectedIndustry, setSelectedIndustry] = useState<string>('Все отрасли');
    const [revenueFilter, setRevenueFilter] = useState<string>('');
    const [growthFilter, setGrowthFilter] = useState<string>('Любая');

    // Selected region from map or table
    const [selectedRegionDetail, setSelectedRegionDetail] = useState<RegionItem | null>(null);

    // Live Backend API State
    const [regions, setRegions] = useState<RegionItem[]>([]);
    const [apiStats, setApiStats] = useState<any>(null);
    const [industryStats, setIndustryStats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
    const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage(null);
        }, 4500);
    };

    // Modal for companies and CRM leads
    const [isCompaniesModalOpen, setIsCompaniesModalOpen] = useState<boolean>(false);
    const [companiesModalRegion, setCompaniesModalRegion] = useState<RegionItem | null>(null);

    // 1. Check initial user profile and 2FA status using unified API client
    const checkAuth = useCallback(async () => {
        const token = getAccessToken();

        if (!token) {
            setIsAuthenticated(false);
            setCurrentUser('');
            setCurrentUserEmail('');
            setIsTwoFactorConfirmed(false);
            setIsTwoFactorBlocked(true);
            return;
        }

        try {
            const user = await fetchCurrentUser();
            setIsAuthenticated(true);
            setCurrentUser(user.name || user.email.split('@')[0]);
            setCurrentUserEmail(user.email);

            const confirmed = Boolean(user.two_factor_confirmed || user.two_factor_confirmed_at);
            setIsTwoFactorConfirmed(confirmed);
            setIsTwoFactorBlocked(!confirmed);
            setApiErrorMessage(null);
        } catch (error: any) {
            console.warn('[checkAuth] Error verifying user session:', error);
            setIsAuthenticated(false);
            setCurrentUser('');
            setCurrentUserEmail('');
            setIsTwoFactorConfirmed(false);
            setIsTwoFactorBlocked(true);
        }
    }, []);

    useEffect(() => {
        checkAuth();

        // Listen to token changes and 401 events from unified api client
        const handleUnauthorized = () => {
            setIsAuthenticated(false);
            setIsTwoFactorConfirmed(false);
            setIsTwoFactorBlocked(true);
            showToast('Сессия завершена. Требуется повторный вход в систему.');
        };

        const handleTokenChange = () => {
            checkAuth();
        };

        window.addEventListener('sanctum:unauthorized', handleUnauthorized);
        window.addEventListener('sanctum:token_changed', handleTokenChange);
        window.addEventListener('sanctum:api_base_changed', checkAuth);

        return () => {
            window.removeEventListener('sanctum:unauthorized', handleUnauthorized);
            window.removeEventListener('sanctum:token_changed', handleTokenChange);
            window.removeEventListener('sanctum:api_base_changed', checkAuth);
        };
    }, [checkAuth]);

    // 2. Load Protected Regions Data via unified apiFetch
    // STRICT: Respects 401, 403, 419, 404 responses from backend
    const loadData = useCallback(async () => {
        const token = getAccessToken();

        if (!token) {
            setIsLiveConnected(false);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setApiErrorMessage(null);

        try {
            const params = new URLSearchParams();

            if (selectedRegion && selectedRegion !== 'Все регионы') {
                params.set('region', selectedRegion);
            }
            if (selectedIndustry && selectedIndustry !== 'Все отрасли') {
                params.set('industry', selectedIndustry);
            }
            if (revenueFilter.trim()) {
                params.set('revenue_min', revenueFilter.trim());
            }
            if (growthFilter && growthFilter !== 'Любая') {
                params.set('growth', growthFilter);
            }

            const queryString = params.toString() ? `?${params.toString()}` : '';

            // Unified apiJson calls with Bearer token
            const [regionsJson, statsJson, industryJson] = await Promise.all([
                apiJson(`/regions${queryString}`),
                apiJson(`/regions/stats${queryString}`),
                apiJson('/regions/by-industry'),
            ]);

            const regionsData = Array.isArray(regionsJson) ? regionsJson : regionsJson?.data;

            if (Array.isArray(regionsData)) {
                setRegions(
                    regionsData.map((r: any) => ({
                        ...r,
                        latitude: r.latitude ?? r.lat ?? r.center?.lat ?? null,
                        longitude: r.longitude ?? r.lon ?? r.center?.lon ?? null,
                    }))
                );
                setIsLiveConnected(true);
                setIsTwoFactorBlocked(false);
            }

            if (statsJson) {
                setApiStats(statsJson);
            }

            const industryData = Array.isArray(industryJson) ? industryJson : industryJson?.data;
            if (Array.isArray(industryData)) {
                setIndustryStats(industryData);
            }
        } catch (error: any) {
            console.error('[loadData] Protected endpoint error:', error);
            setIsLiveConnected(false);

            if (error instanceof ApiError) {
                setApiErrorMessage(error.friendlyMessage);
                if (error.isForbidden) {
                    // HTTP 403: 2FA required
                    setIsTwoFactorConfirmed(false);
                    setIsTwoFactorBlocked(true);
                } else if (error.isUnauthorized) {
                    // HTTP 401: Unauthenticated
                    setIsAuthenticated(false);
                    setIsTwoFactorBlocked(true);
                }
            } else {
                setApiErrorMessage(error?.message || 'Ошибка соединения с API');
            }
        } finally {
            setIsLoading(false);
        }
    }, [selectedRegion, selectedIndustry, revenueFilter, growthFilter]);

    useEffect(() => {
        if (isAuthenticated && !isTwoFactorBlocked) {
            loadData();
        }
    }, [isAuthenticated, isTwoFactorBlocked, loadData]);

    // Handle Logout
    const handleLogout = async () => {
        await logout();
        setIsAuthenticated(false);
        setCurrentUser('');
        setCurrentUserEmail('');
        setIsTwoFactorConfirmed(false);
        setIsTwoFactorBlocked(true);
        showToast('Выход из системы выполнен. Bearer-токен отозван.');
    };

    // Handle successful login
    const handleLoginSuccess = (user: UserProfile) => {
        setShowLoginModal(false);
        setIsAuthenticated(true);
        setCurrentUser(user.name || user.email.split('@')[0]);
        setCurrentUserEmail(user.email);

        const confirmed = Boolean(user.two_factor_confirmed || user.two_factor_confirmed_at);
        setIsTwoFactorConfirmed(confirmed);
        setIsTwoFactorBlocked(!confirmed);

        showToast(`Добро пожаловать, ${user.name || user.email}!`);
        if (confirmed) {
            loadData();
        }
    };

    // Active Regions for display
    const filteredRegions = regions;

    // Dynamic statistics
    const stats = useMemo(() => {
        if (apiStats) return apiStats;
        const totalCount = filteredRegions.length;
        const whiteSpotsCount = filteredRegions.filter((r) => r.is_white_spot).length;
        const whiteSpotsPercent = totalCount > 0 ? Math.round((whiteSpotsCount / totalCount) * 1000) / 10 : 0;
        const avgCoverage =
            totalCount > 0
                ? Math.round(filteredRegions.reduce((acc, r) => acc + r.coverage_percent, 0) / totalCount)
                : 0;
        const totalCompanies = filteredRegions.reduce((acc, r) => acc + r.companies_count, 0);
        const totalHeadroom = filteredRegions.reduce((acc, r) => acc + r.headroom_revenue_mln, 0);

        return {
            density: totalCompanies > 0 ? Math.round(totalCompanies / 2.8) : 1240,
            white_spots_percent: whiteSpotsPercent,
            new_clients: Math.max(12, Math.round(whiteSpotsCount * 5.2)),
            coverage: avgCoverage > 0 ? avgCoverage : 34,
            total_headroom_mln: totalHeadroom,
            total_potential: 5488,
        };
    }, [apiStats, filteredRegions]);

    const handleOpenCompaniesForRegion = (region: RegionItem | null) => {
        setCompaniesModalRegion(region);
        setIsCompaniesModalOpen(true);
    };

    const handleGenerateDocForTopLead = async (region: RegionItem) => {
        try {
            const res = await apiJson<any>(`/regions/${region.id}/leads?status=leads`);
            const list = Array.isArray(res) ? res : res?.data;
            let lead: any = null;
            if (Array.isArray(list) && list.length > 0) {
                lead = list[0];
            }
            if (!lead) {
                lead =
                    INITIAL_COMPANIES.find((c) => c.region_id === region.id && !c.is_client) ||
                    INITIAL_COMPANIES.find((c) => c.region_id === region.id);
            }
            if (lead) {
                generateCommercialOfferDoc(lead);
                showToast(`Коммерческое предложение для «${lead.name}» (${region.name}) успешно сформировано (.doc)`);
            } else {
                showToast(`Сформировано коммерческое предложение для региона ${region.name}`);
            }
        } catch {
            const lead = INITIAL_COMPANIES.find((c) => c.region_id === region.id);
            if (lead) generateCommercialOfferDoc(lead);
            showToast(`Сформировано коммерческое предложение для региона ${region.name}`);
        }
    };

    return (
        <div className="app-layout">
            {/* Companies & CRM Leads Registry Modal */}
            {isCompaniesModalOpen && (
                <CompaniesListModal
                    region={companiesModalRegion}
                    onClose={() => setIsCompaniesModalOpen(false)}
                />
            )}

            {/* 2FA Management Modal when opened via header */}
            {show2FAModal && (
                <TwoFactorSetupScreen
                    isModal={true}
                    onClose={() => setShow2FAModal(false)}
                    currentUserEmail={currentUserEmail}
                    onStatusChange={(confirmed) => {
                        setIsTwoFactorConfirmed(confirmed);
                        setIsTwoFactorBlocked(!confirmed);
                    }}
                    onSuccess={() => {
                        setIsTwoFactorConfirmed(true);
                        setIsTwoFactorBlocked(false);
                        setShow2FAModal(false);
                        showToast('Двухфакторная аутентификация подтверждена! Доступ к Радару присутствия открыт.');
                        loadData();
                    }}
                />
            )}

            {/* Strict 5-Step Login Modal */}
            <LoginModal
                isOpen={showLoginModal}
                onSuccess={handleLoginSuccess}
                onClose={() => setShowLoginModal(false)}
            />

            {/* Diagnostic & API Settings Modal */}
            <ApiSettingsModal
                isOpen={showApiSettingsModal}
                onClose={() => setShowApiSettingsModal(false)}
                onRefreshAppState={() => {
                    checkAuth();
                    loadData();
                }}
            />

            {/* Navigation Header */}
            <Header
                currentUser={currentUser}
                currentUserEmail={currentUserEmail}
                isTwoFactorConfirmed={isTwoFactorConfirmed}
                onOpen2FA={() => setShow2FAModal(true)}
                onOpenApiSettings={() => setShowApiSettingsModal(true)}
                onOpenLogin={() => setShowLoginModal(true)}
                onLogout={handleLogout}
            />

            <main className="main-content">
                <div className="container">
                    {/* Module Navigation Tabs */}
                    <div className="tabs">
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'radar' ? 'active' : ''}`}
                            onClick={() => setActiveTab('radar')}
                        >
                            Модуль 1: Радар присутствия
                        </button>
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'navigator' ? 'active' : ''}`}
                            onClick={() => setActiveTab('navigator')}
                        >
                            Модуль 2: Инвестиционный навигатор
                        </button>
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
                            onClick={() => setActiveTab('calculator')}
                        >
                            Модуль 3: Калькулятор сделок
                        </button>
                    </div>

                    {/* Module 1: Радар присутствия */}
                    {activeTab === 'radar' && (
                        <div id="radar" className="module-panel" style={{ display: 'block', marginTop: '16px' }}>
                            {/* Not Authenticated Screen */}
                            {!isAuthenticated ? (
                                <div
                                    style={{
                                        background: '#ffffff',
                                        borderRadius: '14px',
                                        border: '1px solid #e2e8f0',
                                        padding: '48px 24px',
                                        textAlign: 'center',
                                        maxWidth: '540px',
                                        margin: '32px auto',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '56px',
                                            height: '56px',
                                            borderRadius: '14px',
                                            background: 'rgba(119, 0, 255, 0.1)',
                                            color: 'var(--rt-purple)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '16px',
                                        }}
                                    >
                                        <Lock size={28} />
                                    </div>
                                    <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', color: 'var(--rt-dark)' }}>
                                        Требуется авторизация в системе (Sanctum)
                                    </h3>
                                    <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px' }}>
                                        Защищенные эндпоинты <b>/api/regions</b> требуют валидный Bearer-токен и подтвержденную двухфакторную аутентификацию (Fortify 2FA).
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => setShowLoginModal(true)}
                                        style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 700, gap: '8px' }}
                                    >
                                        <LogIn size={16} />
                                        <span>Войти с учетной записью</span>
                                    </button>
                                </div>
                            ) : isTwoFactorBlocked ? (
                                /* Authenticated, but 2FA Not Confirmed (HTTP 403 Forbidden Gate) */
                                <TwoFactorSetupScreen
                                    currentUserEmail={currentUserEmail}
                                    onStatusChange={(confirmed) => {
                                        setIsTwoFactorConfirmed(confirmed);
                                        setIsTwoFactorBlocked(!confirmed);
                                    }}
                                    onSuccess={() => {
                                        setIsTwoFactorConfirmed(true);
                                        setIsTwoFactorBlocked(false);
                                        showToast('Двухфакторная аутентификация подтверждена! Доступ к Радару присутствия открыт.');
                                        loadData();
                                    }}
                                />
                            ) : (
                                /* Authenticated AND 2FA Confirmed: Full Access Granted */
                                <>
                                    {/* Live Backend Connection Status Bar */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '14px',
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            padding: '10px 16px',
                                            fontSize: '12.5px',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                          style={{
                              display: 'inline-block',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: isLiveConnected ? '#10b981' : '#f59e0b',
                              boxShadow: isLiveConnected ? '0 0 8px #10b981' : 'none',
                          }}
                      />
                                            <span style={{ fontWeight: 600, color: '#334155' }}>
                        {isLiveConnected
                            ? `🟢 Бэкенд подключен (${getApiBaseUrl()}/regions) — Bearer токен Sanctum верифицирован, 2FA активна`
                            : '🟡 Подключение к API...'}
                      </span>
                                            {isLoading && (
                                                <span style={{ color: '#64748b', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <RefreshCw size={11} className="animate-spin" />
                          Синхронизация данных...
                        </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>
                        Субъектов в выборке: <b>{filteredRegions.length}</b>
                      </span>
                                            <button
                                                type="button"
                                                onClick={loadData}
                                                className="btn btn-outline"
                                                style={{
                                                    padding: '4px 10px',
                                                    fontSize: '11.5px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    borderColor: '#cbd5e1',
                                                }}
                                                title="Синхронизировать данные с сервером"
                                            >
                                                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                                                <span>Обновить</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Backend Error Alert if any */}
                                    {apiErrorMessage && (
                                        <div
                                            style={{
                                                background: '#fff1f2',
                                                border: '1px solid #fda4af',
                                                borderRadius: '8px',
                                                padding: '12px 16px',
                                                marginBottom: '16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                color: '#be123c',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                                            <span style={{ flex: 1 }}>{apiErrorMessage}</span>
                                        </div>
                                    )}

                                    {/* Comprehensive Filter Toolbar */}
                                    <Filters
                                        selectedRegion={selectedRegion}
                                        onRegionChange={setSelectedRegion}
                                        selectedIndustry={selectedIndustry}
                                        onIndustryChange={setSelectedIndustry}
                                        revenueFilter={revenueFilter}
                                        onRevenueChange={setRevenueFilter}
                                        growthFilter={growthFilter}
                                        onGrowthChange={setGrowthFilter}
                                        onApply={() => {}}
                                        regionsToExport={filteredRegions}
                                        onOpenLeadsRegistry={() => handleOpenCompaniesForRegion(null)}
                                    />

                                    {/* Top-3 White Spots AI Recommendations Widget */}
                                    <WhiteSpotsRecommendations
                                        regions={filteredRegions}
                                        onSelectRegion={(reg) => {
                                            setSelectedRegionDetail(reg);
                                            document.getElementById('radar-map-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        onOpenCompanies={(reg) => handleOpenCompaniesForRegion(reg)}
                                    />

                                    {/* 4 KPI Summary Cards */}
                                    <div className="dashboard-grid">
                                        <div className="card">
                                            <h3>Плотность бизнеса</h3>
                                            <div className="stat-value">
                                                {new Intl.NumberFormat('ru-RU').format(stats.density)}
                                            </div>
                                            <div className="stat-label">активных компаний на 1 км² (ЕГРЮЛ)</div>
                                        </div>

                                        <div className="card highlight">
                                            <h3>Потенциал «Белых пятен»</h3>
                                            <div className="stat-value">{stats.white_spots_percent}%</div>
                                            <div className="stat-label">
                                                емкость рынка: ~{new Intl.NumberFormat('ru-RU').format(stats.total_headroom_mln)} млн ₽
                                            </div>
                                        </div>

                                        <div className="card">
                                            <h3>Новые клиенты РТК</h3>
                                            <div className="stat-value">+{stats.new_clients}</div>
                                            <div className="stat-label">прирост контрактов за месяц</div>
                                        </div>

                                        <div className="card">
                                            <h3>Охват рынка контрактами</h3>
                                            <div className="stat-value">{stats.coverage}%</div>
                                            <div className="stat-label">средняя пенетрация сервисов связи</div>
                                        </div>
                                    </div>

                                    {/* Industry Penetration Breakdown (/api/regions/by-industry) */}
                                    {industryStats.length > 0 && (
                                        <div
                                            style={{
                                                background: '#fff',
                                                borderRadius: '10px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                                padding: '18px 22px',
                                                marginBottom: '20px',
                                                border: '1px solid #e2e8f0',
                                                borderLeft: '4px solid var(--rt-purple)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div>
                                                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--rt-dark)' }}>
                                                        📊 Отраслевой срез пенетрации контрактов РТК (Live API /api/regions/by-industry)
                                                    </h4>
                                                    <p style={{ fontSize: '12.5px', color: 'var(--rt-muted)', margin: '2px 0 0' }}>
                                                        Отрасли с пенетрацией &lt;10% классифицируются как приоритетные «Белые пятна» для экспансии
                                                    </p>
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                                                    gap: '12px',
                                                }}
                                            >
                                                {industryStats.map((ind: any) => {
                                                    const isLowPenetration = (ind.penetration_pct ?? 0) <= 10;
                                                    return (
                                                        <div
                                                            key={ind.industry}
                                                            style={{
                                                                padding: '10px 12px',
                                                                borderRadius: '6px',
                                                                background: isLowPenetration ? '#fff7ed' : '#f8fafc',
                                                                border: `1px solid ${isLowPenetration ? '#fed7aa' : '#e2e8f0'}`,
                                                                fontSize: '12px',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{ind.industry}</span>
                                                                <span
                                                                    style={{
                                                                        fontWeight: 700,
                                                                        fontSize: '11px',
                                                                        padding: '1px 6px',
                                                                        borderRadius: '4px',
                                                                        background: isLowPenetration ? 'rgba(255, 79, 18, 0.15)' : 'rgba(119, 0, 255, 0.1)',
                                                                        color: isLowPenetration ? 'var(--rt-orange)' : 'var(--rt-purple)',
                                                                    }}
                                                                >
                                  {ind.penetration_pct}%
                                </span>
                                                            </div>

                                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>
                                                                <span>Компаний: <b>{new Intl.NumberFormat('ru-RU').format(ind.companies_count)}</b></span>
                                                                <span>Клиентов: <b>{ind.clients_count}</b></span>
                                                            </div>

                                                            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div
                                                                    style={{
                                                                        width: `${Math.min(100, Math.max(3, ind.penetration_pct))}%`,
                                                                        height: '100%',
                                                                        background: isLowPenetration ? 'var(--rt-orange)' : 'var(--rt-purple)',
                                                                        borderRadius: '3px',
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Interactive Radar Heatmap */}
                                    <RadarMap
                                        regions={filteredRegions}
                                        selectedRegion={selectedRegion}
                                        selectedRegionDetail={selectedRegionDetail}
                                        onSelectRegion={(reg) => setSelectedRegionDetail(reg)}
                                        onOpenCompanies={(reg) => handleOpenCompaniesForRegion(reg)}
                                        onGenerateDoc={(region) => handleGenerateDocForTopLead(region)}
                                    />

                                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <p style={{ color: 'var(--rt-muted)', fontSize: '13px', margin: 0 }}>
                                            💡 <b>Подсказка:</b> Карта отображает гео-концентрацию выручки и активных компаний. Нажимайте на метки локаций для открытия реестра лидов с выгрузкой в CRM и формирования КП (.doc).
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            style={{ fontSize: '12px', padding: '4px 10px', borderColor: 'var(--rt-orange)', color: 'var(--rt-orange)' }}
                                            onClick={() => handleOpenCompaniesForRegion(null)}
                                        >
                                            Реестр всех лидов ({stats.total_potential ? new Intl.NumberFormat('ru-RU').format(stats.total_potential) : '5 488'} целевых предприятий)
                                        </button>
                                    </div>

                                    {/* Sales Economics Banner */}
                                    <SalesEconomicsBanner headroomMln={stats.total_headroom_mln} />

                                    {/* Regional Registry Table */}
                                    <div style={{ marginTop: '24px', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '22px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                            <div>
                                                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rt-dark)', margin: 0 }}>
                                                    Сводный реестр регионов и скоринг коммерческого потенциала ({filteredRegions.length})
                                                </h3>
                                                <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: '4px 0 0' }}>
                                                    Нажмите на строку для детального анализа, выгрузки лидов или формирования КП
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    style={{ fontSize: '13px', padding: '8px 14px' }}
                                                    onClick={() => handleOpenCompaniesForRegion(null)}
                                                >
                                                    Реестр компаний и лидов
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                                <thead>
                                                <tr style={{ borderBottom: '2px solid #eee', color: 'var(--rt-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '10px 12px' }}>Регион / Локация</th>
                                                    <th style={{ padding: '10px 12px' }}>Статус покрытия</th>
                                                    <th style={{ padding: '10px 12px' }}>Скоринг рынка</th>
                                                    <th style={{ padding: '10px 12px' }}>Отрасль</th>
                                                    <th style={{ padding: '10px 12px' }}>Компаний всего</th>
                                                    <th style={{ padding: '10px 12px' }}>Клиенты РТК</th>
                                                    <th style={{ padding: '10px 12px' }}>Свободный потенциал</th>
                                                    <th style={{ padding: '10px 12px' }}>Охват</th>
                                                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Действия</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {filteredRegions.map((r) => (
                                                    <tr
                                                        key={r.id}
                                                        onClick={() => setSelectedRegionDetail(r)}
                                                        style={{
                                                            borderBottom: '1px solid #f2f2f2',
                                                            cursor: 'pointer',
                                                            background: selectedRegionDetail?.id === r.id ? '#fdf5f2' : 'transparent',
                                                            transition: 'background 0.2s',
                                                        }}
                                                    >
                                                        <td style={{ padding: '12px', fontWeight: 600 }}>{r.name}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            {r.is_white_spot ? (
                                                                <span style={{ color: 'var(--rt-orange)', fontWeight: 600, fontSize: '12px', background: 'rgba(255, 79, 18, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                                    ⚠️ Белое пятно
                                  </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--rt-purple)', fontWeight: 600, fontSize: '12px', background: 'rgba(119, 0, 255, 0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                                    ✅ Покрыт
                                  </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                <span
                                    style={{
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        color: r.score >= 80 ? 'var(--rt-orange)' : r.score >= 60 ? 'var(--rt-purple)' : '#666',
                                    }}
                                >
                                  {r.score}/100 ({r.priority_grade})
                                </span>
                                                        </td>
                                                        <td style={{ padding: '12px', color: '#555' }}>{r.industry}</td>
                                                        <td style={{ padding: '12px', fontWeight: 600 }}>{r.companies_count}</td>
                                                        <td style={{ padding: '12px', color: 'var(--rt-purple)', fontWeight: 600 }}>{r.clients_count}</td>
                                                        <td style={{ padding: '12px', color: 'var(--rt-orange)', fontWeight: 600 }}>+{r.potential_count}</td>
                                                        <td style={{ padding: '12px' }}>{r.coverage_percent}%</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline"
                                                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenCompaniesForRegion(r);
                                                                    }}
                                                                >
                                                                    Лиды (+{r.potential_count})
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline"
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        fontSize: '12px',
                                                                        borderColor: '#7700FF',
                                                                        color: '#7700FF',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px',
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGenerateDocForTopLead(r);
                                                                    }}
                                                                    title="Сформировать официальное КП в Word (.doc)"
                                                                >
                                                                    <FileText size={12} />
                                                                    <span>КП (.doc)</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Floating Region Detail Panel */}
                                    {selectedRegionDetail && (
                                        <div
                                            style={{
                                                position: 'fixed',
                                                bottom: '24px',
                                                right: '24px',
                                                width: '370px',
                                                background: '#fff',
                                                borderRadius: '10px',
                                                boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
                                                padding: '20px',
                                                zIndex: 2000,
                                                borderLeft: `5px solid ${selectedRegionDetail.is_white_spot ? 'var(--rt-orange)' : 'var(--rt-purple)'}`,
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '17px', color: 'var(--rt-dark)' }}>
                                                        {selectedRegionDetail.name}
                                                    </h4>
                                                    <span style={{ fontSize: '12px', color: selectedRegionDetail.is_white_spot ? 'var(--rt-orange)' : 'var(--rt-purple)', fontWeight: 600 }}>
                            {selectedRegionDetail.is_white_spot ? '⚠️ Белое пятно' : '✅ Покрытый регион'} • Скоринг: {selectedRegionDetail.score}/100
                          </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRegionDetail(null)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999', lineHeight: 1 }}
                                                >
                                                    &times;
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginTop: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Выручка рынка:</span>
                                                    <b>{new Intl.NumberFormat('ru-RU').format(selectedRegionDetail.revenue)} ₽</b>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Свободная емкость рынка:</span>
                                                    <b style={{ color: 'var(--rt-orange)' }}>~{selectedRegionDetail.headroom_revenue_mln} млн ₽</b>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Всего компаний:</span>
                                                    <b>{selectedRegionDetail.companies_count}</b>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Клиентская база РТК:</span>
                                                    <b style={{ color: 'var(--rt-purple)' }}>{selectedRegionDetail.clients_count}</b>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Неохваченный потенциал:</span>
                                                    <b style={{ color: 'var(--rt-orange)' }}>+{selectedRegionDetail.potential_count}</b>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: '11px', color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={13} color="#10b981" />
                            Верификация: ЕГРЮЛ, ФНС
                          </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    style={{ flex: 1, fontSize: '12px', padding: '9px 10px' }}
                                                    onClick={() => handleOpenCompaniesForRegion(selectedRegionDetail)}
                                                >
                                                    📋 Реестр лидов
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    style={{
                                                        flex: 1,
                                                        fontSize: '12px',
                                                        padding: '9px 10px',
                                                        borderColor: '#7700FF',
                                                        color: '#7700FF',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                    }}
                                                    onClick={() => handleGenerateDocForTopLead(selectedRegionDetail)}
                                                    title="Скачать КП в формате Word"
                                                >
                                                    <FileText size={13} />
                                                    <span>Скачать КП (.doc)</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Module 2: Инвестиционный навигатор */}
                    {activeTab === 'navigator' && (
                        <div id="navigator" className="module-panel" style={{ display: 'block', marginTop: '16px' }}>
                            <InvestmentNavigator />
                        </div>
                    )}

                    {/* Module 3: Калькулятор сделок */}
                    {activeTab === 'calculator' && (
                        <div id="calculator" className="module-panel" style={{ display: 'block', marginTop: '16px' }}>
                           <DealCalculator/>
                        </div>
                    )}
                </div>
            </main>

            {/* Toast Notification */}
            {toastMessage && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 9999,
                        background: '#111827',
                        color: '#ffffff',
                        padding: '12px 18px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderLeft: '4px solid #10b981',
                        maxWidth: '440px',
                    }}
                >
                    <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{toastMessage}</span>
                    <button
                        onClick={() => setToastMessage(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '0 4px',
                            fontSize: '18px',
                            lineHeight: 1,
                        }}
                    >
                        &times;
                    </button>
                </div>
            )}

            <Footer />
        </div>
    );
}
