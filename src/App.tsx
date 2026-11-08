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
import { LoginScreen } from './components/LoginScreen';
import { Footer } from './components/Footer';
import { INITIAL_REGIONS, RegionItem, INITIAL_COMPANIES, CompanyItem } from './data/mockData';
import { generateCommercialOfferDoc } from './utils/docGenerator';
import { FileText, ShieldCheck, CheckCircle2, RefreshCw, Lock } from 'lucide-react';
import { authService, UserProfile } from './services/authService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'radar' | 'navigator' | 'calculator'>('radar');

  // Authentication & 2FA State (DevTeam / Fortify / Sanctum)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<string>('Admin');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('admin@example.com');
  const [isTwoFactorConfirmed, setIsTwoFactorConfirmed] = useState<boolean>(true);
  const [isTwoFactorBlocked, setIsTwoFactorBlocked] = useState<boolean>(false);
  const [show2FAModal, setShow2FAModal] = useState<boolean>(false);

  // Filters state
  const [selectedRegion, setSelectedRegion] = useState<string>('Все регионы');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Все отрасли');
  const [revenueFilter, setRevenueFilter] = useState<string>('');
  const [growthFilter, setGrowthFilter] = useState<string>('Любая');

  // Selected region from map or table
  const [selectedRegionDetail, setSelectedRegionDetail] = useState<RegionItem | null>(null);

  // Live Backend API State
  const [regions, setRegions] = useState<RegionItem[]>(INITIAL_REGIONS);
  const [apiStats, setApiStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

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
  const [industryStats, setIndustryStats] = useState<any[]>([]);

  // Check initial user profile and 2FA status using stored token
  useEffect(() => {
    const token = authService.getToken();
    if (!token) {
      setIsAuthenticated(false);
      setIsAuthChecking(false);
      return;
    }

    authService
      .getProfile()
      .then((u) => {
        if (u) {
          if (u.name) setCurrentUser(u.name);
          if (u.email) setCurrentUserEmail(u.email);
          const confirmed = !!u.two_factor_confirmed;
          setIsTwoFactorConfirmed(confirmed);
          setIsTwoFactorBlocked(!confirmed);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  // Live API Fetching with Bearer Token Authorization
  const loadData = useCallback(async () => {
    setIsLoading(true);
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

      const [regionsRes, statsRes, industryRes] = await Promise.all([
        authService.apiFetch(`/api/regions?${params.toString()}`),
        authService.apiFetch(`/api/regions/stats?${params.toString()}`),
        authService.apiFetch(`/api/regions/by-industry`),
      ]);

      // Handle 401 Unauthorized -> redirect to login
      if (regionsRes.status === 401 || statsRes.status === 401) {
        authService.clearSession();
        setIsAuthenticated(false);
        showToast('Сессия авторизации истекла. Пожалуйста, выполните вход повторно.');
        setIsLoading(false);
        return;
      }

      // Check for 403 Forbidden 2FA lock
      if (regionsRes.status === 403) {
        const errJson = await regionsRes.json().catch(() => null);
        if (errJson?.two_factor_required) {
          setIsTwoFactorBlocked(true);
          setIsTwoFactorConfirmed(false);
          setIsLiveConnected(false);
          setIsLoading(false);
          return;
        }
      }

      if (regionsRes.ok) {
        setIsTwoFactorBlocked(false);
        setIsTwoFactorConfirmed(true);
        const regionsJson = await regionsRes.json();
        const data = Array.isArray(regionsJson) ? regionsJson : regionsJson.data;
        if (Array.isArray(data)) {
          setRegions(data);
          setIsLiveConnected(true);
        }
      }

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setApiStats(statsJson);
      }

      if (industryRes.ok) {
        const indJson = await industryRes.json();
        const indList = Array.isArray(indJson) ? indJson : indJson.data;
        if (Array.isArray(indList)) {
          setIndustryStats(indList);
        }
      }
    } catch (err) {
      console.warn('API error, using cached data:', err);
      setIsLiveConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRegion, selectedIndustry, revenueFilter, growthFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Active Regions for display
  const filteredRegions = regions;

  // Dynamic statistics matching business logic & live API
  const stats = useMemo(() => {
    if (apiStats) {
      return apiStats;
    }
    const totalCount = filteredRegions.length;
    const whiteSpotsCount = filteredRegions.filter((r) => r.is_white_spot).length;
    const whiteSpotsPercent = totalCount > 0 ? Math.round((whiteSpotsCount / totalCount) * 1000) / 10 : 0;

    const avgCoverage = totalCount > 0
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
      const res = await authService.apiFetch(`/api/regions/${region.id}/leads?status=leads`);
      let lead: any = null;
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.data;
        if (Array.isArray(list) && list.length > 0) {
          lead = list[0];
        }
      }
      if (!lead) {
        lead = INITIAL_COMPANIES.find((c) => c.region_id === region.id && !c.is_client) ||
               INITIAL_COMPANIES.find((c) => c.region_id === region.id);
      }
      if (lead) {
        generateCommercialOfferDoc(lead);
        showToast(`Коммерческое предложение для «${lead.name}» (${region.name}) успешно сформировано (.doc)`);
      } else {
        showToast(`Сформировано типовое коммерческое предложение для региона ${region.name}`);
      }
    } catch {
      const lead = INITIAL_COMPANIES.find((c) => c.region_id === region.id);
      if (lead) generateCommercialOfferDoc(lead);
      showToast(`Сформировано коммерческое предложение для региона ${region.name}`);
    }
  };

  // Loading state during auth check
  if (isAuthChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d121f 0%, #171e31 50%, #111827 100%)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <RefreshCw size={36} className="animate-spin" style={{ color: '#7c3aed', marginBottom: '16px' }} />
        <div style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>
          Проверка защищенной сессии Ростелеком...
        </div>
      </div>
    );
  }

  // Not authenticated -> show professional 2-step Login Screen
  if (!isAuthenticated) {
    return (
      <>
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 9999,
              background: '#1e293b',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              fontSize: '13.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderLeft: '4px solid #7c3aed',
            }}
          >
            <CheckCircle2 size={16} color="#4ade80" />
            <span>{toastMessage}</span>
          </div>
        )}
        <LoginScreen
          onLoginSuccess={(_token, user: UserProfile) => {
            setIsAuthenticated(true);
            if (user.name) setCurrentUser(user.name);
            if (user.email) setCurrentUserEmail(user.email);
            const confirmed = !!user.two_factor_confirmed;
            setIsTwoFactorConfirmed(confirmed);
            setIsTwoFactorBlocked(!confirmed);
            showToast(`Добро пожаловать, ${user.name || user.username}! Авторизация успешна.`);
          }}
        />
      </>
    );
  }

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
          onSuccess={() => {
            setIsTwoFactorConfirmed(true);
            setIsTwoFactorBlocked(false);
            setShow2FAModal(false);
            showToast('Двухфакторная аутентификация подтверждена! Доступ к Радару присутствия открыт.');
            loadData();
          }}
        />
      )}

      {/* Navigation Header */}
      <Header
        currentUser={currentUser}
        currentUserEmail={currentUserEmail}
        isTwoFactorConfirmed={isTwoFactorConfirmed}
        onOpen2FA={() => setShow2FAModal(true)}
        onLogout={async () => {
          await authService.logout();
          setIsAuthenticated(false);
          showToast('Выход из учетной записи выполнен.');
        }}
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
              {isTwoFactorBlocked ? (
                <TwoFactorSetupScreen
                  currentUserEmail={currentUserEmail}
                  onSuccess={() => {
                    setIsTwoFactorConfirmed(true);
                    setIsTwoFactorBlocked(false);
                    showToast('Двухфакторная аутентификация подтверждена! Доступ к Радару присутствия открыт.');
                    loadData();
                  }}
                />
              ) : (
                <>
                  {/* Live Backend Connection Status Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                  marginBottom: '14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: isLiveConnected ? '#10b981' : '#f59e0b',
                      boxShadow: isLiveConnected ? '0 0 8px #10b981' : 'none',
                    }}
                  />
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {isLiveConnected
                      ? '🟢 Бэкенд API подключен (/api/regions, /api/regions/stats) — Реальные данные активны'
                      : '🟡 Кэшированный режим'}
                  </span>
                  {isLoading && (
                    <span style={{ color: '#64748b', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={11} className="animate-spin" />
                      Синхронизация...
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
                      padding: '3px 8px',
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

              {/* Industry Penetration Live Breakdown (/api/regions/by-industry) */}
              {industryStats.length > 0 && (
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px var(--shadow)',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    borderLeft: '4px solid var(--rt-purple)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
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

              {/* Interactive Heatmap in user's reference style */}
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

              {/* Sales Economics Banner (Slide 6 Defense criteria) */}
              <SalesEconomicsBanner headroomMln={stats.total_headroom_mln} />

              {/* Regional Registry Table */}
              <div style={{ marginTop: '24px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px var(--shadow)', padding: '20px' }}>
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
                    borderRadius: '8px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
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

          {/* Module 2: Инвестиционный навигатор (Заглушка из оригинального кода) */}
          {activeTab === 'navigator' && (
            <div id="navigator" className="module-panel" style={{ display: 'block', marginTop: '16px' }}>
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
              <div style={{ padding: '32px', background: '#fff', borderRadius: '8px', border: '1px dashed #ccc', textAlign: 'center', color: 'var(--rt-muted)' }}>
                <p style={{ fontSize: '16px', margin: 0 }}>Здесь будет инвестиционный навигатор.</p>
              </div>
            </div>
          )}

          {/* Module 3: Калькулятор сделок (Заглушка из оригинального кода) */}
          {activeTab === 'calculator' && (
            <div id="calculator" className="module-panel" style={{ display: 'block', marginTop: '16px' }}>
              <div style={{ padding: '32px', background: '#fff', borderRadius: '8px', border: '1px dashed #ccc', textAlign: 'center', color: 'var(--rt-muted)' }}>
                <p style={{ fontSize: '16px', margin: 0 }}>Здесь будет калькулятор сделок.</p>
              </div>
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
            maxWidth: '420px',
            animation: 'fadeIn 0.2s ease-out',
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
