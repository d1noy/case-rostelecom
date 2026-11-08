/**
 * Модуль 2: «Инвестиционный навигатор» (Поиск проектов)
 * Верстка + рабочая клиентская фильтрация на моковых данных.
 * Положить в src/components/InvestmentNavigator.tsx
 */
import React, { useMemo, useState } from 'react';
import {
    Bell,
    BellRing,
    Building2,
    CalendarDays,
    Cpu,
    Factory,
    Flame,
    Lock,
    MapPin,
    RotateCcw,
    ShieldCheck,
    Trash2,
    Wallet,
} from 'lucide-react';

/* ───────────── Типы и справочники ───────────── */

type Stage = 'design' | 'construction' | 'launch';
type NeedId = 'it' | 'asu' | 'phys' | 'info';

interface Project {
    id: number;
    name: string;
    initiator: string;
    industry: string;
    stage: Stage;
    region: string;
    city: string;
    x: number; // % по схеме карты
    y: number;
    investMln: number;
    date: string; // ISO — ключевая дата события
    needs: NeedId[];
    description: string;
    tender: boolean;
}

const STAGES: Record<Stage, { label: string; color: string; event: string }> = {
    design: { label: 'Проектирование', color: '#749FD6', event: 'Завершение проектирования' },
    construction: { label: 'Строительство', color: '#FF4F12', event: 'Ключевой этап стройки' },
    launch: { label: 'Запуск', color: '#7700FF', event: 'Ввод в эксплуатацию' },
};

const NEEDS: { id: NeedId; label: string; icon: React.ElementType }[] = [
    { id: 'it', label: 'ИТ-инфраструктура', icon: Cpu },
    { id: 'asu', label: 'АСУ ТП', icon: Factory },
    { id: 'phys', label: 'Физическая безопасность', icon: Lock },
    { id: 'info', label: 'Информационная безопасность', icon: ShieldCheck },
];

const INDUSTRIES = [
    'ТЭК',
    'Торговля',
    'Логистика и складское хозяйство',
    'АПК',
    'Промышленность',
    'Услуги населению',
];

const PROJECTS: Project[] = [
    {
        id: 1,
        name: 'Логистический хаб «Восточный»',
        initiator: 'ООО «ТрансЛогик»',
        industry: 'Логистика и складское хозяйство',
        stage: 'construction',
        region: 'Московская область',
        city: 'Ногинск',
        x: 31,
        y: 50,
        investMln: 4800,
        date: '2026-11-12',
        needs: ['it', 'phys'],
        description: 'Мультитемпературный складской комплекс 120 тыс. м² с системой WMS и периметральной охраной.',
        tender: true,
    },
    {
        id: 2,
        name: 'Модернизация НПЗ: установка гидрокрекинга',
        initiator: 'ПАО «Нефтегаз-Юг»',
        industry: 'ТЭК',
        stage: 'design',
        region: 'Краснодарский край',
        city: 'Туапсе',
        x: 22,
        y: 80,
        investMln: 18500,
        date: '2026-12-03',
        needs: ['asu', 'info', 'it'],
        description: 'Новая технологическая линия, потребуется АСУ ТП, сегментация сетей и защита КИИ.',
        tender: false,
    },
    {
        id: 3,
        name: 'Агрокомплекс «Зелёные поля»',
        initiator: 'АО «АгроТатарстан»',
        industry: 'АПК',
        stage: 'launch',
        region: 'Республика Татарстан',
        city: 'Лаишево',
        x: 41,
        y: 56,
        investMln: 2300,
        date: '2026-10-30',
        needs: ['it', 'asu'],
        description: 'Тепличный комплекс с автоматизацией микроклимата и системой учёта урожая.',
        tender: false,
    },
    {
        id: 4,
        name: 'Вход федеральной сети гипермаркетов в регион',
        initiator: 'ГК «ГрандМаркет»',
        industry: 'Торговля',
        stage: 'design',
        region: 'Свердловская область',
        city: 'Екатеринбург',
        x: 51,
        y: 49,
        investMln: 3100,
        date: '2027-01-20',
        needs: ['it', 'phys', 'info'],
        description: 'Пять гипермаркетов и распределительный центр: связь, видеонаблюдение, кассовая инфраструктура.',
        tender: true,
    },
    {
        id: 5,
        name: 'Завод композитных материалов',
        initiator: 'ООО «СибКомпозит»',
        industry: 'Промышленность',
        stage: 'construction',
        region: 'Новосибирская область',
        city: 'Новосибирск',
        x: 66,
        y: 57,
        investMln: 6700,
        date: '2027-02-15',
        needs: ['asu', 'it', 'phys'],
        description: 'Производство с полной автоматизацией линий и контролем доступа на территорию.',
        tender: false,
    },
    {
        id: 6,
        name: 'Горно-обогатительный комбинат',
        initiator: 'ПАО «СеверныйМеталл»',
        industry: 'Промышленность',
        stage: 'construction',
        region: 'Красноярский край',
        city: 'Норильск',
        x: 74,
        y: 38,
        investMln: 24000,
        date: '2027-03-01',
        needs: ['asu', 'info'],
        description: 'Крупнейший проект в выборке: удалённая площадка, нужны спутниковые каналы и защищённые АСУ ТП.',
        tender: true,
    },
    {
        id: 7,
        name: 'Сеть медицинских центров «Здоровье+»',
        initiator: 'ООО «МедГрупп»',
        industry: 'Услуги населению',
        stage: 'launch',
        region: 'Санкт-Петербург',
        city: 'Санкт-Петербург',
        x: 25,
        y: 37,
        investMln: 950,
        date: '2026-11-05',
        needs: ['it', 'info'],
        description: 'Семь клиник: единая ИТ-среда, защита персональных данных пациентов.',
        tender: false,
    },
    {
        id: 8,
        name: 'Складской комплекс класса А',
        initiator: 'АО «ПортЛогистик»',
        industry: 'Логистика и складское хозяйство',
        stage: 'design',
        region: 'Приморский край',
        city: 'Находка',
        x: 92,
        y: 72,
        investMln: 5200,
        date: '2027-04-10',
        needs: ['it', 'phys'],
        description: 'Терминал у порта с интеграцией в таможенные системы и видеоаналитикой.',
        tender: false,
    },
    {
        id: 9,
        name: 'Зерновой терминал',
        initiator: 'ООО «ЮгЗерно»',
        industry: 'АПК',
        stage: 'construction',
        region: 'Ростовская область',
        city: 'Азов',
        x: 27,
        y: 72,
        investMln: 3800,
        date: '2026-12-22',
        needs: ['asu', 'it'],
        description: 'Элеватор и погрузочный комплекс с автоматикой взвешивания и учёта.',
        tender: true,
    },
    {
        id: 10,
        name: 'Сеть АЗС нового формата',
        initiator: 'ПАО «Нефтегаз-Юг»',
        industry: 'ТЭК',
        stage: 'launch',
        region: 'Тюменская область',
        city: 'Тюмень',
        x: 57,
        y: 44,
        investMln: 1500,
        date: '2026-11-28',
        needs: ['it', 'phys', 'info'],
        description: '40 станций: связь, видеонаблюдение, платёжная инфраструктура.',
        tender: false,
    },
];

/* ───────────── Утилиты ───────────── */

const fmtMoney = (mln: number) =>
    mln >= 1000
        ? `${(mln / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млрд ₽`
        : `${mln.toLocaleString('ru-RU')} млн ₽`;

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const monthKey = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

interface Subscription {
    id: number;
    industry: string;
    kind: 'tender' | 'project' | 'both';
    channel: 'email' | 'telegram' | 'push';
    active: boolean;
}

const KIND_LABEL: Record<Subscription['kind'], string> = {
    tender: 'Новые тендеры',
    project: 'Новые инвестпроекты',
    both: 'Тендеры и проекты',
};
const CHANNEL_LABEL: Record<Subscription['channel'], string> = {
    email: 'E-mail',
    telegram: 'Telegram',
    push: 'Push в кабинете',
};

/* ───────────── Стили (адаптив внутри компонента) ───────────── */

const CSS = `
.nav2 { display: flex; flex-direction: column; gap: 20px; }
.nav2-head h2 { font-size: clamp(18px, 4vw, 22px); font-weight: 800; color: var(--rt-dark); margin: 0 0 4px; }
.nav2-head p { font-size: 13.5px; color: var(--rt-muted); margin: 0; max-width: 860px; }

.nav2-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.nav2-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
  border: 1px solid #d9dee7; background: #fff; color: #334155; cursor: pointer;
  transition: all .15s;
}
.nav2-chip:hover { border-color: var(--rt-purple); color: var(--rt-purple); }
.nav2-chip.on { background: rgba(119,0,255,.1); border-color: var(--rt-purple); color: var(--rt-purple); }

.nav2-layout { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.nav2-sticky { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 16px; }

.nav2-panel {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,.04); padding: 18px;
}
.nav2-panel h3 { font-size: 16px; font-weight: 700; margin: 0 0 2px; color: var(--rt-dark); }
.nav2-sub { font-size: 12.5px; color: var(--rt-muted); margin: 0 0 14px; }

.nav2-month { font-size: 12px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--rt-muted); margin: 6px 0 -4px; }
.nav2-tl-item { cursor: pointer; transition: background .15s, box-shadow .15s; flex-wrap: nowrap; }
.nav2-tl-item:hover { box-shadow: 0 4px 14px rgba(0,0,0,.1); }
.nav2-tl-item.sel { background: #fdf5f2; box-shadow: 0 4px 14px rgba(255,79,18,.18); }

.nav2-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.nav2-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
  background: #f1f5f9; color: #475569;
}
.nav2-tag.tender { background: rgba(255,79,18,.12); color: var(--rt-orange); }

.nav2-map {
  position: relative; width: 100%; aspect-ratio: 16 / 10; min-height: 260px;
  border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;
  background:
    linear-gradient(rgba(119,0,255,.05) 1px, transparent 1px) 0 0 / 10% 10%,
    linear-gradient(90deg, rgba(119,0,255,.05) 1px, transparent 1px) 0 0 / 10% 10%,
    linear-gradient(135deg, #f4f1ff, #eef4fb);
}
.nav2-heat { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; filter: blur(6px); }
.nav2-dot {
  position: absolute; width: 16px; height: 16px; border-radius: 50%;
  transform: translate(-50%, -50%); border: 2px solid #fff; cursor: pointer; padding: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,.3); transition: transform .15s;
}
.nav2-dot:hover, .nav2-dot.sel { transform: translate(-50%, -50%) scale(1.35); z-index: 5; }
.nav2-dot.sel { outline: 3px solid rgba(255,79,18,.35); }
.nav2-map-note { position: absolute; left: 10px; bottom: 8px; font-size: 11px; color: #64748b; background: rgba(255,255,255,.8); padding: 2px 8px; border-radius: 4px; }
.nav2-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 12px; color: #475569; }
.nav2-legend span { display: inline-flex; align-items: center; gap: 6px; }
.nav2-legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

.nav2-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; font-size: 13px; margin: 12px 0; }
.nav2-detail-grid div { min-width: 0; overflow-wrap: anywhere; }
.nav2-detail-grid small { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; }

.nav2-alerts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.nav2-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.nav2-form .full { grid-column: 1 / -1; }
.nav2-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.nav2-field label { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; color: var(--rt-muted); }
.nav2-field select, .nav2-field input {
  width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
  font: inherit; font-size: 14px; background: #fff; color: var(--rt-dark);
}
.nav2-field select:focus, .nav2-field input:focus { outline: none; border-color: var(--rt-purple); }

.nav2-sub-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
}
.nav2-sub-item + .nav2-sub-item { margin-top: 8px; }
.nav2-sub-item b { font-size: 13px; }
.nav2-sub-item small { display: block; color: #64748b; font-size: 12px; }
.nav2-empty { padding: 28px 16px; text-align: center; color: var(--rt-muted); font-size: 13.5px; border: 1px dashed #cbd5e1; border-radius: 10px; background: #fff; }

@media (max-width: 1024px) {
  .nav2-layout { grid-template-columns: 1fr; }
  .nav2-sticky { position: static; order: -1; }
  .nav2-alerts { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .nav2-panel { padding: 14px; }
  .nav2-form { grid-template-columns: 1fr; }
  .nav2-detail-grid { grid-template-columns: 1fr; }
  .nav2-field select, .nav2-field input { font-size: 16px; min-height: 44px; }
  .nav2-sub-item { flex-direction: column; align-items: stretch; }
  .nav2-map { min-height: 220px; }
}
`;

/* ───────────── Компонент ───────────── */

export function InvestmentNavigator() {
    // Фильтры
    const [stage, setStage] = useState<'all' | Stage>('all');
    const [industry, setIndustry] = useState('Все отрасли');
    const [initiator, setInitiator] = useState('Все инициаторы');
    const [region, setRegion] = useState('Все локации');
    const [needs, setNeeds] = useState<NeedId[]>([]);
    const [onlyTenders, setOnlyTenders] = useState(false);
    const [query, setQuery] = useState('');

    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Оповещения
    const [subs, setSubs] = useState<Subscription[]>([
        { id: 1, industry: 'ТЭК', kind: 'tender', channel: 'email', active: true },
    ]);
    const [subIndustry, setSubIndustry] = useState('Все отрасли');
    const [subKind, setSubKind] = useState<Subscription['kind']>('both');
    const [subChannel, setSubChannel] = useState<Subscription['channel']>('email');
    const [subDone, setSubDone] = useState(false);

    const initiators = useMemo(() => Array.from(new Set(PROJECTS.map((p) => p.initiator))), []);
    const regions = useMemo(() => Array.from(new Set(PROJECTS.map((p) => p.region))), []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return PROJECTS.filter((p) => {
            if (stage !== 'all' && p.stage !== stage) return false;
            if (industry !== 'Все отрасли' && p.industry !== industry) return false;
            if (initiator !== 'Все инициаторы' && p.initiator !== initiator) return false;
            if (region !== 'Все локации' && p.region !== region) return false;
            if (needs.length > 0 && !needs.some((n) => p.needs.includes(n))) return false;
            if (onlyTenders && !p.tender) return false;
            if (q && !`${p.name} ${p.initiator} ${p.region} ${p.city}`.toLowerCase().includes(q)) return false;
            return true;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [stage, industry, initiator, region, needs, onlyTenders, query]);

    const grouped = useMemo(() => {
        const map = new Map<string, Project[]>();
        filtered.forEach((p) => {
            const k = monthKey(p.date);
            map.set(k, [...(map.get(k) || []), p]);
        });
        return Array.from(map.entries());
    }, [filtered]);

    const selected = PROJECTS.find((p) => p.id === selectedId) || null;
    const totalInvest = filtered.reduce((s, p) => s + p.investMln, 0);
    const tendersCount = filtered.filter((p) => p.tender).length;
    const buildCount = filtered.filter((p) => p.stage === 'construction').length;

    const toggleNeed = (id: NeedId) =>
        setNeeds((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));

    const resetFilters = () => {
        setStage('all');
        setIndustry('Все отрасли');
        setInitiator('Все инициаторы');
        setRegion('Все локации');
        setNeeds([]);
        setOnlyTenders(false);
        setQuery('');
    };

    const addSubscription = () => {
        setSubs((prev) => [
            ...prev,
            { id: Date.now(), industry: subIndustry, kind: subKind, channel: subChannel, active: true },
        ]);
        setSubDone(true);
        setTimeout(() => setSubDone(false), 3000);
    };

    return (
        <div className="nav2">
            <style>{CSS}</style>

            {/* Заголовок модуля */}
            <div className="nav2-head">
                <h2>Инвестиционный навигатор</h2>
                <p>
                    Мониторинг капитальных вложений и будущих потребностей рынка: стройки, модернизации и вход
                    федеральных игроков в регионы. Найдите проект раньше конкурентов.
                </p>
            </div>

            {/* KPI */}
            <div className="dashboard-grid" style={{ marginBottom: 0 }}>
                <div className="card">
                    <h3>Проектов в выборке</h3>
                    <div className="stat-value">{filtered.length}</div>
                    <div className="stat-label">из {PROJECTS.length} отслеживаемых</div>
                </div>
                <div className="card highlight">
                    <h3>Объём инвестиций</h3>
                    <div className="stat-value">{fmtMoney(totalInvest)}</div>
                    <div className="stat-label">суммарно по выбранным проектам</div>
                </div>
                <div className="card">
                    <h3>На стадии стройки</h3>
                    <div className="stat-value">{buildCount}</div>
                    <div className="stat-label">ближайшие заказчики инфраструктуры</div>
                </div>
                <div className="card">
                    <h3>Открытые тендеры</h3>
                    <div className="stat-value">{tendersCount}</div>
                    <div className="stat-label">можно подать заявку уже сейчас</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="nav2-panel">
                <div className="filters" style={{ marginBottom: 14 }}>
                    <div className="filter-group">
                        <label htmlFor="n2-search">Поиск</label>
                        <input
                            id="n2-search"
                            type="text"
                            placeholder="Проект, компания, город…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <label htmlFor="n2-industry">Отрасль</label>
                        <select id="n2-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                            <option>Все отрасли</option>
                            {INDUSTRIES.map((i) => (
                                <option key={i}>{i}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label htmlFor="n2-initiator">Инициатор проекта</label>
                        <select id="n2-initiator" value={initiator} onChange={(e) => setInitiator(e.target.value)}>
                            <option>Все инициаторы</option>
                            {initiators.map((i) => (
                                <option key={i}>{i}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label htmlFor="n2-region">Локация реализации</label>
                        <select id="n2-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                            <option>Все локации</option>
                            {regions.map((r) => (
                                <option key={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <button type="button" className="btn btn-outline" onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <RotateCcw size={14} />
                        Сбросить
                    </button>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                        <div className="nav2-sub" style={{ marginBottom: 8 }}>Стадия проекта</div>
                        <div className="nav2-chips">
                            {([['all', 'Все стадии']] as [string, string][])
                                .concat(Object.entries(STAGES).map(([k, v]) => [k, v.label] as [string, string]))
                                .map(([k, label]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={`nav2-chip ${stage === k ? 'on' : ''}`}
                                        onClick={() => setStage(k as 'all' | Stage)}
                                    >
                                        {k !== 'all' && (
                                            <i style={{ width: 8, height: 8, borderRadius: '50%', background: STAGES[k as Stage].color, display: 'inline-block' }} />
                                        )}
                                        {label}
                                    </button>
                                ))}
                        </div>
                    </div>

                    <div>
                        <div className="nav2-sub" style={{ marginBottom: 8 }}>Классификация по потребностям</div>
                        <div className="nav2-chips">
                            {NEEDS.map((n) => {
                                const Icon = n.icon;
                                return (
                                    <button
                                        key={n.id}
                                        type="button"
                                        className={`nav2-chip ${needs.includes(n.id) ? 'on' : ''}`}
                                        onClick={() => toggleNeed(n.id)}
                                    >
                                        <Icon size={13} />
                                        {n.label}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                className={`nav2-chip ${onlyTenders ? 'on' : ''}`}
                                onClick={() => setOnlyTenders((v) => !v)}
                            >
                                <Wallet size={13} />
                                Только с тендерами
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Таймлайн + карта */}
            <div className="nav2-layout">
                {/* Таймлайн */}
                <div className="nav2-panel">
                    <h3>Таймлайн инвестиционных событий</h3>
                    <p className="nav2-sub">Нажмите на событие — оно подсветится на тепловой карте</p>

                    {filtered.length === 0 ? (
                        <div className="nav2-empty">
                            По выбранным фильтрам проектов не найдено.
                            <div style={{ marginTop: 10 }}>
                                <button type="button" className="btn btn-outline" onClick={resetFilters}>
                                    Сбросить фильтры
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="timeline">
                            {grouped.map(([month, items]) => (
                                <React.Fragment key={month}>
                                    <div className="nav2-month">{month}</div>
                                    {items.map((p) => {
                                        const st = STAGES[p.stage];
                                        return (
                                            <div
                                                key={p.id}
                                                className={`timeline-item nav2-tl-item ${selectedId === p.id ? 'sel' : ''}`}
                                                style={{ borderLeftColor: st.color }}
                                                onClick={() => setSelectedId(p.id)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(p.id)}
                                            >
                                                <div className="tl-dot" style={{ background: st.color }} />
                                                <div className="tl-content" style={{ flex: 1 }}>
                                                    <h4>{p.name}</h4>
                                                    <div className="tl-meta">
                                                        {fmtDate(p.date)} · {st.event}
                                                    </div>
                                                    <div className="tl-meta" style={{ marginTop: 2 }}>
                                                        {p.initiator} · {p.city}, {p.region}
                                                    </div>
                                                    <div className="nav2-tags">
                                                        <span className="nav2-tag" style={{ background: `${st.color}22`, color: st.color }}>
                                                            {st.label}
                                                        </span>
                                                        <span className="nav2-tag">{p.industry}</span>
                                                        <span className="nav2-tag">
                                                            <Wallet size={11} /> {fmtMoney(p.investMln)}
                                                        </span>
                                                        {p.tender && <span className="nav2-tag tender">Тендер открыт</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {/* Карта + карточка проекта */}
                <div className="nav2-sticky">
                    <div className="nav2-panel">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Flame size={16} color="#FF4F12" /> Тепловая карта инвестиций
                        </h3>
                        <p className="nav2-sub">Размер пятна — объём вложений, цвет метки — стадия проекта</p>

                        <div className="nav2-map">
                            {filtered.map((p) => {
                                const size = 50 + Math.sqrt(p.investMln) * 0.9;
                                return (
                                    <div
                                        key={`h${p.id}`}
                                        className="nav2-heat"
                                        style={{
                                            left: `${p.x}%`,
                                            top: `${p.y}%`,
                                            width: size,
                                            height: size,
                                            background: 'radial-gradient(circle, rgba(255,79,18,.55), rgba(255,79,18,0) 70%)',
                                        }}
                                    />
                                );
                            })}
                            {filtered.map((p) => (
                                <button
                                    key={`d${p.id}`}
                                    type="button"
                                    aria-label={p.name}
                                    title={`${p.name} — ${p.city}`}
                                    className={`nav2-dot ${selectedId === p.id ? 'sel' : ''}`}
                                    style={{ left: `${p.x}%`, top: `${p.y}%`, background: STAGES[p.stage].color }}
                                    onClick={() => setSelectedId(p.id)}
                                />
                            ))}
                            <span className="nav2-map-note">Схематичная карта РФ (макет)</span>
                        </div>

                        <div className="nav2-legend">
                            {Object.values(STAGES).map((s) => (
                                <span key={s.label}>
                                    <i style={{ background: s.color }} />
                                    {s.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="nav2-panel" style={{ borderLeft: `4px solid ${selected ? STAGES[selected.stage].color : '#cbd5e1'}` }}>
                        {selected ? (
                            <>
                                <h3>{selected.name}</h3>
                                <p className="nav2-sub" style={{ marginBottom: 0 }}>
                                    {STAGES[selected.stage].label} · {fmtDate(selected.date)}
                                </p>
                                <p style={{ fontSize: 13, color: '#475569', margin: '10px 0 0' }}>{selected.description}</p>

                                <div className="nav2-detail-grid">
                                    <div>
                                        <small>Инициатор</small>
                                        <Building2 size={12} style={{ verticalAlign: -1 }} /> {selected.initiator}
                                    </div>
                                    <div>
                                        <small>Локация</small>
                                        <MapPin size={12} style={{ verticalAlign: -1 }} /> {selected.city}, {selected.region}
                                    </div>
                                    <div>
                                        <small>Инвестиции</small>
                                        <b style={{ color: 'var(--rt-orange)' }}>{fmtMoney(selected.investMln)}</b>
                                    </div>
                                    <div>
                                        <small>Ключевая дата</small>
                                        <CalendarDays size={12} style={{ verticalAlign: -1 }} /> {fmtDate(selected.date)}
                                    </div>
                                </div>

                                <div className="nav2-sub" style={{ marginBottom: 6 }}>Потребности заказчика</div>
                                <div className="nav2-tags" style={{ marginTop: 0 }}>
                                    {selected.needs.map((id) => {
                                        const n = NEEDS.find((x) => x.id === id)!;
                                        const Icon = n.icon;
                                        return (
                                            <span key={id} className="nav2-tag" style={{ background: 'rgba(119,0,255,.1)', color: 'var(--rt-purple)' }}>
                                                <Icon size={11} /> {n.label}
                                            </span>
                                        );
                                    })}
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn-primary" style={{ flex: '1 1 150px' }}>
                                        Взять в работу
                                    </button>
                                    <button type="button" className="btn btn-outline" style={{ flex: '1 1 150px' }} onClick={() => setSelectedId(null)}>
                                        Закрыть
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ fontSize: 13.5, color: 'var(--rt-muted)', textAlign: 'center', padding: '12px 0' }}>
                                Выберите проект в таймлайне или на карте, чтобы увидеть детали
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Оповещения */}
            <div className="nav2-alerts">
                <div className="nav2-panel">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BellRing size={16} color="#7700FF" /> Система оповещений
                    </h3>
                    <p className="nav2-sub">Подпишитесь и узнавайте о новых тендерах и инвестпроектах в нужной отрасли первыми</p>

                    <div className="nav2-form">
                        <div className="nav2-field full">
                            <label htmlFor="n2-sub-industry">Отрасль</label>
                            <select id="n2-sub-industry" value={subIndustry} onChange={(e) => setSubIndustry(e.target.value)}>
                                <option>Все отрасли</option>
                                {INDUSTRIES.map((i) => (
                                    <option key={i}>{i}</option>
                                ))}
                            </select>
                        </div>
                        <div className="nav2-field">
                            <label htmlFor="n2-sub-kind">Что отслеживать</label>
                            <select id="n2-sub-kind" value={subKind} onChange={(e) => setSubKind(e.target.value as Subscription['kind'])}>
                                {Object.entries(KIND_LABEL).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="nav2-field">
                            <label htmlFor="n2-sub-channel">Канал</label>
                            <select id="n2-sub-channel" value={subChannel} onChange={(e) => setSubChannel(e.target.value as Subscription['channel'])}>
                                {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="full">
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                onClick={addSubscription}
                            >
                                <Bell size={15} /> Подписаться
                            </button>
                            {subDone && (
                                <div style={{ marginTop: 8, fontSize: 12.5, color: '#047857', fontWeight: 600 }}>
                                    ✓ Подписка оформлена
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="nav2-panel">
                    <h3>Мои подписки ({subs.length})</h3>
                    <p className="nav2-sub">Уведомления приходят сразу после появления события</p>

                    {subs.length === 0 ? (
                        <div className="nav2-empty">Активных подписок пока нет</div>
                    ) : (
                        subs.map((s) => (
                            <div key={s.id} className="nav2-sub-item" style={{ opacity: s.active ? 1 : 0.55 }}>
                                <div style={{ minWidth: 0 }}>
                                    <b>{s.industry}</b>
                                    <small>
                                        {KIND_LABEL[s.kind]} · {CHANNEL_LABEL[s.channel]}
                                    </small>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={s.active}
                                            onChange={() =>
                                                setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)))
                                            }
                                        />
                                        Активна
                                    </label>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ padding: '4px 8px' }}
                                        aria-label="Удалить подписку"
                                        onClick={() => setSubs((prev) => prev.filter((x) => x.id !== s.id))}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default InvestmentNavigator;
