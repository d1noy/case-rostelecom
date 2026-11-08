/**
 * Модуль 3: «Калькулятор сделок» (Экспресс-оценка)
 * Верстка + рабочий клиентский расчёт на моковых данных.
 * Положить в src/components/DealCalculator.tsx
 */
import React, { useMemo, useState } from 'react';
import {
    BarChart3,
    Calculator,
    ClipboardCopy,
    Download,
    FileText,
    Package,
    RefreshCw,
    Scale,
    TrendingUp,
} from 'lucide-react';

/* ───────────── Справочники ───────────── */

const PROJECT_TYPES = [
    { id: 'net', label: 'Сеть связи (ЛВС / ВОЛС)', basePerObject: 1.8 },
    { id: 'video', label: 'Видеонаблюдение и СКУД', basePerObject: 1.2 },
    { id: 'dc', label: 'ЦОД / серверная', basePerObject: 6.5 },
    { id: 'asu', label: 'АСУ ТП', basePerObject: 4.2 },
    { id: 'ib', label: 'Информационная безопасность', basePerObject: 2.4 },
];

const SIZES = [
    { id: 's', label: 'Малый объект', mult: 0.7 },
    { id: 'm', label: 'Средний объект', mult: 1 },
    { id: 'l', label: 'Крупный объект', mult: 1.6 },
];

const FINANCING = [
    { id: 'own', label: 'Собственные средства заказчика', markup: 0 },
    { id: 'inst', label: 'Рассрочка 12 мес.', markup: 0.06 },
    { id: 'lease', label: 'Лизинг', markup: 0.09 },
    { id: 'gov', label: 'Госзакупка (44-ФЗ / 223-ФЗ)', markup: -0.03 },
];

const WORKS = [
    { id: 'design', label: 'Проектирование', share: 0.12 },
    { id: 'smr', label: 'Строительно-монтажные работы', share: 0.5 },
    { id: 'pnr', label: 'Пусконаладка', share: 0.18 },
    { id: 'training', label: 'Обучение персонала', share: 0.05 },
    { id: 'support', label: 'Техподдержка 12 мес.', share: 0.15 },
];

interface CatalogItem {
    id: string;
    name: string;
    price: number; // ₽ за единицу
    source: string;
}

const EQUIPMENT: CatalogItem[] = [
    { id: 'sw48', name: 'Коммутатор 48 портов, PoE', price: 62000, source: 'Прайс дистрибьютора А' },
    { id: 'ap', name: 'Точка доступа Wi-Fi 6', price: 18500, source: 'Прайс дистрибьютора А' },
    { id: 'rt', name: 'Маршрутизатор уровня ядра', price: 134000, source: 'Прайс дистрибьютора Б' },
    { id: 'cam', name: 'IP-камера 4 Мп', price: 14800, source: 'Прайс дистрибьютора Б' },
    { id: 'nvr', name: 'Видеорегистратор 32 канала', price: 96000, source: 'Прайс дистрибьютора Б' },
    { id: 'srv', name: 'Сервер 2U', price: 780000, source: 'Прайс дистрибьютора В' },
    { id: 'ups', name: 'ИБП 3 кВА', price: 118000, source: 'Прайс дистрибьютора В' },
    { id: 'nas', name: 'СХД 24 ТБ', price: 540000, source: 'Прайс дистрибьютора В' },
    { id: 'acs', name: 'Контроллер СКУД', price: 31000, source: 'Прайс дистрибьютора Б' },
    { id: 'plc', name: 'Промышленный контроллер (ПЛК)', price: 87000, source: 'Прайс дистрибьютора Г' },
];

const SOFTWARE: CatalogItem[] = [
    { id: 'vms', name: 'Видеоплатформа (лицензия на канал)', price: 4200, source: 'Прайс вендора' },
    { id: 'hv', name: 'Гипервизор / ОС (лицензия на сервер)', price: 58000, source: 'Прайс вендора' },
    { id: 'fw', name: 'Межсетевой экран NGFW (лицензия)', price: 420000, source: 'Прайс вендора' },
    { id: 'scada', name: 'SCADA (лицензия)', price: 640000, source: 'Прайс вендора' },
    { id: 'mon', name: 'Система мониторинга (лицензия)', price: 210000, source: 'Прайс вендора' },
];

const PRICE_DATE = '24.10.2026';

/* Аналоги: коэффициент относительно оптимальной цены (ретроданные, демо) */
const ANALOGS = [
    { name: 'Проект «Север-12»', year: 2024, k: 0.84, margin: 11 },
    { name: 'Проект «Волга-3»', year: 2025, k: 0.92, margin: 15 },
    { name: 'Проект «Урал-7»', year: 2025, k: 0.98, margin: 19 },
    { name: 'Проект «Сибирь-5»', year: 2025, k: 1.06, margin: 24 },
    { name: 'Проект «Юг-9»', year: 2026, k: 1.13, margin: 27 },
    { name: 'Проект «Центр-1»', year: 2026, k: 1.22, margin: 31 },
];

/* ───────────── Утилиты ───────────── */

const fmtMln = (mln: number) =>
    mln >= 1000
        ? `${(mln / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млрд ₽`
        : `${mln.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`;

const fmtRub = (rub: number) => `${Math.round(rub).toLocaleString('ru-RU')} ₽`;

const CSS = `
.dc { display: flex; flex-direction: column; gap: 20px; }
.dc-head h2 { font-size: clamp(18px, 4vw, 22px); font-weight: 800; color: var(--rt-dark); margin: 0 0 4px; }
.dc-head p { font-size: 13.5px; color: var(--rt-muted); margin: 0; max-width: 860px; }

.dc-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 20px; align-items: start; }
.dc-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.dc-sticky { position: sticky; top: 84px; }

.dc-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.04); padding: 18px; min-width: 0; }
.dc-panel h3 { font-size: 16px; font-weight: 700; margin: 0 0 2px; color: var(--rt-dark); display: flex; align-items: center; gap: 6px; }
.dc-sub { font-size: 12.5px; color: var(--rt-muted); margin: 0 0 14px; }

.dc-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dc-form .full { grid-column: 1 / -1; }
.dc-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dc-field label, .dc-label { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; color: var(--rt-muted); }
.dc-field select, .dc-field input[type="text"], .dc-field input[type="number"] {
  width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
  font: inherit; font-size: 14px; background: #fff; color: var(--rt-dark);
}
.dc-field select:focus, .dc-field input:focus { outline: none; border-color: var(--rt-purple); }
.dc-range { width: 100%; accent-color: var(--rt-purple); }
.dc-range-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.dc-range-row b { color: var(--rt-purple); font-size: 15px; }

.dc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dc-chip {
  display: inline-flex; align-items: center; padding: 7px 12px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; border: 1px solid #d9dee7; background: #fff;
  color: #334155; cursor: pointer; transition: all .15s;
}
.dc-chip:hover { border-color: var(--rt-purple); color: var(--rt-purple); }
.dc-chip.on { background: rgba(119,0,255,.1); border-color: var(--rt-purple); color: var(--rt-purple); }

.dc-items { display: flex; flex-direction: column; gap: 8px; }
.dc-item { display: grid; grid-template-columns: minmax(0, 1fr) 84px; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
.dc-item.on { border-color: var(--rt-purple); background: rgba(119,0,255,.04); }
.dc-item b { font-size: 13px; display: block; overflow-wrap: anywhere; }
.dc-item small { display: block; font-size: 11.5px; color: #64748b; }
.dc-item input { width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font: inherit; font-size: 14px; text-align: center; }

.dc-fork-track { position: relative; height: 12px; border-radius: 6px; background: linear-gradient(90deg, #fecaca, #fde68a 45%, #bbf7d0); margin: 28px 6px 34px; }
.dc-fork-mark { position: absolute; top: -26px; transform: translateX(-50%); text-align: center; font-size: 11px; color: #475569; white-space: nowrap; }
.dc-fork-mark::after { content: ''; position: absolute; left: 50%; top: 26px; width: 3px; height: 18px; background: currentColor; transform: translateX(-50%); border-radius: 2px; }
.dc-fork-mark b { display: block; font-size: 13px; color: var(--rt-dark); }
.dc-fork-mark.opt { color: var(--rt-orange); }
.dc-fork-mark.opt b { color: var(--rt-orange); font-size: 15px; }

.dc-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.dc-kpi { padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
.dc-kpi small { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #94a3b8; display: block; }
.dc-kpi b { font-size: clamp(15px, 3.4vw, 19px); display: block; margin-top: 2px; overflow-wrap: anywhere; }
.dc-kpi.main { border-color: var(--rt-orange); background: #fdf5f2; }
.dc-kpi.main b { color: var(--rt-orange); }

.dc-cost { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; font-size: 13px; }
.dc-cost div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }
.dc-cost div span:last-child { font-weight: 600; text-align: right; }

.dc-charts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 20px; }
.dc-svg { width: 100%; height: auto; display: block; }

.dc-an-row { display: grid; grid-template-columns: 120px minmax(0, 1fr) 76px; gap: 10px; align-items: center; font-size: 12.5px; padding: 5px 0; }
.dc-an-row.me { font-weight: 700; color: var(--rt-orange); }
.dc-an-bar { height: 14px; background: #eef2f7; border-radius: 7px; overflow: hidden; }
.dc-an-bar i { display: block; height: 100%; border-radius: 7px; background: var(--rt-light-blue); }
.dc-an-row.me .dc-an-bar i { background: var(--rt-orange); }
.dc-an-row span:last-child { text-align: right; color: #64748b; font-weight: 600; }

.dc-kp { white-space: pre-wrap; font-size: 13px; line-height: 1.55; background: #fafafa; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; max-height: 360px; overflow: auto; color: #1e293b; overflow-wrap: anywhere; }
.dc-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.dc-actions .btn { display: inline-flex; align-items: center; gap: 6px; }

@media (max-width: 1100px) {
  .dc-layout { grid-template-columns: 1fr; }
  .dc-sticky { position: static; }
  .dc-charts { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .dc-panel { padding: 14px; }
  .dc-form { grid-template-columns: 1fr; }
  .dc-kpis { grid-template-columns: 1fr; }
  .dc-field select, .dc-field input[type="text"], .dc-field input[type="number"] { font-size: 16px; min-height: 44px; }
  .dc-an-row { grid-template-columns: 90px minmax(0, 1fr) 64px; gap: 6px; font-size: 11.5px; }
  .dc-item { grid-template-columns: minmax(0, 1fr) 70px; }
  .dc-fork-mark { font-size: 10px; }
}
`;

/* ───────────── Компонент ───────────── */

export function DealCalculator() {
    const [typeId, setTypeId] = useState('net');
    const [sizeId, setSizeId] = useState('m');
    const [objects, setObjects] = useState(5);
    const [term, setTerm] = useState(8);
    const [financingId, setFinancingId] = useState('own');
    const [works, setWorks] = useState<string[]>(['design', 'smr', 'pnr']);
    const [equipQty, setEquipQty] = useState<Record<string, number>>({ sw48: 10, ap: 20 });
    const [softQty, setSoftQty] = useState<Record<string, number>>({ mon: 1 });
    const [customer, setCustomer] = useState('');
    const [copied, setCopied] = useState(false);

    const type = PROJECT_TYPES.find((t) => t.id === typeId)!;
    const size = SIZES.find((s) => s.id === sizeId)!;
    const financing = FINANCING.find((f) => f.id === financingId)!;

    const calc = useMemo(() => {
        const worksShare = WORKS.filter((w) => works.includes(w.id)).reduce((s, w) => s + w.share, 0);
        const worksMln = type.basePerObject * objects * size.mult * worksShare;
        const equipMln =
            EQUIPMENT.reduce((s, e) => s + (equipQty[e.id] || 0) * e.price, 0) / 1_000_000;
        const softMln = SOFTWARE.reduce((s, e) => s + (softQty[e.id] || 0) * e.price, 0) / 1_000_000;

        const costMln = worksMln * 0.62 + equipMln * 0.86 + softMln * 0.7; // себестоимость
        const rush = term < 6 ? 1.12 : term < 9 ? 1.05 : 1;
        const fin = 1 + financing.markup;

        const base = Math.max(costMln, 0.001);
        const min = base * 1.12 * rush * fin;
        const opt = base * 1.28 * rush * fin;
        const max = base * 1.45 * rush * fin;

        const margin = (price: number) => (price > 0 ? ((price - costMln) / price) * 100 : 0);

        return {
            worksMln,
            equipMln,
            softMln,
            costMln,
            min,
            opt,
            max,
            marginMin: margin(min),
            marginOpt: margin(opt),
            marginMax: margin(max),
            rush,
            totalMln: worksMln + equipMln + softMln,
        };
    }, [type, size, objects, term, financing, works, equipQty, softQty]);

    const analogs = useMemo(
        () =>
            ANALOGS.map((a) => ({ ...a, price: calc.opt * a.k })).sort((x, y) => x.price - y.price),
        [calc.opt]
    );
    const analogRows = useMemo(() => {
        const all = [...analogs.map((a) => ({ name: a.name, price: a.price, me: false })), { name: 'Ваш проект', price: calc.opt, me: true }];
        return all.sort((x, y) => x.price - y.price);
    }, [analogs, calc.opt]);
    const maxAnalog = Math.max(...analogRows.map((r) => r.price), 0.001);
    const avgAnalog = analogs.reduce((s, a) => s + a.price, 0) / analogs.length;
    const avgDiff = avgAnalog > 0 ? ((calc.opt - avgAnalog) / avgAnalog) * 100 : 0;

    const toggleWork = (id: string) =>
        setWorks((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));

    const reset = () => {
        setTypeId('net');
        setSizeId('m');
        setObjects(5);
        setTerm(8);
        setFinancingId('own');
        setWorks(['design', 'smr', 'pnr']);
        setEquipQty({});
        setSoftQty({});
    };

    /* Позиция меток на «вилке» */
    const forkPos = (v: number) => ((v - calc.min) / Math.max(calc.max - calc.min, 0.0001)) * 100;

    /* Текст КП */
    const today = new Date().toLocaleDateString('ru-RU');
    const equipLines = EQUIPMENT.filter((e) => equipQty[e.id] > 0).map(
        (e) => `  • ${e.name} — ${equipQty[e.id]} шт.`
    );
    const softLines = SOFTWARE.filter((s) => softQty[s.id] > 0).map(
        (s) => `  • ${s.name} — ${softQty[s.id]} шт.`
    );
    const workLines = WORKS.filter((w) => works.includes(w.id)).map((w) => `  • ${w.label}`);

    const kpText = `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ____ от ${today}

Заказчик: ${customer || '[наименование заказчика]'}
Предмет: ${type.label} (${size.label.toLowerCase()}, объектов: ${objects})
Срок реализации: ${term} мес.
Схема финансирования: ${financing.label}

Состав работ:
${workLines.join('\n') || '  • [не выбрано]'}

Оборудование:
${equipLines.join('\n') || '  • [не выбрано]'}

Программное обеспечение:
${softLines.join('\n') || '  • [не выбрано]'}

Стоимость проекта:
  Минимальная цена: ${fmtMln(calc.min)}
  Оптимальная цена: ${fmtMln(calc.opt)}
  Верхняя граница:  ${fmtMln(calc.max)}
  (цены указаны без НДС)

Предложение действительно 30 дней с даты составления.

С уважением,
[ФИО], [должность]
[контактные данные]`;

    const downloadDoc = () => {
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>КП</title></head><body style="font-family:Arial;font-size:12pt"><pre style="font-family:Arial;white-space:pre-wrap">${kpText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')}</pre></body></html>`;
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kommercheskoe-predlozhenie.doc';
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyKp = async () => {
        try {
            await navigator.clipboard.writeText(kpText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            /* буфер недоступен */
        }
    };

    /* Диаграмма маржинальности (SVG) */
    const bars = [
        { label: 'Минимум', value: calc.marginMin, color: '#749FD6' },
        { label: 'Оптимум', value: calc.marginOpt, color: '#FF4F12' },
        { label: 'Максимум', value: calc.marginMax, color: '#7700FF' },
    ];
    const chartMax = Math.max(40, ...bars.map((b) => b.value + 4));

    return (
        <div className="dc">
            <style>{CSS}</style>

            <div className="dc-head">
                <h2>Калькулятор сделок</h2>
                <p>
                    Экспресс-оценка стоимости проекта: ценовая «вилка» на основе похожих проектов и актуальных цен на
                    оборудование и ПО, расчёт маржинальности и готовый шаблон коммерческого предложения.
                </p>
            </div>

            <div className="dc-layout">
                {/* ─── Левая колонка: ввод параметров ─── */}
                <div className="dc-col">
                    <div className="dc-panel">
                        <h3>
                            <Calculator size={16} color="#7700FF" /> Параметры проекта
                        </h3>
                        <p className="dc-sub">Расчёт обновляется сразу при изменении любого поля</p>

                        <div className="dc-form">
                            <div className="dc-field full">
                                <label htmlFor="dc-type">Тип проекта</label>
                                <select id="dc-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                                    {PROJECT_TYPES.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="dc-field">
                                <label htmlFor="dc-size">Масштаб объекта</label>
                                <select id="dc-size" value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
                                    {SIZES.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="dc-field">
                                <label htmlFor="dc-fin">Схема финансирования</label>
                                <select id="dc-fin" value={financingId} onChange={(e) => setFinancingId(e.target.value)}>
                                    {FINANCING.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="dc-field">
                                <div className="dc-range-row">
                                    <span className="dc-label">Количество объектов</span>
                                    <b>{objects}</b>
                                </div>
                                <input
                                    className="dc-range"
                                    type="range"
                                    min={1}
                                    max={50}
                                    value={objects}
                                    onChange={(e) => setObjects(Number(e.target.value))}
                                    aria-label="Количество объектов"
                                />
                            </div>

                            <div className="dc-field">
                                <div className="dc-range-row">
                                    <span className="dc-label">Срок, мес.</span>
                                    <b>{term}</b>
                                </div>
                                <input
                                    className="dc-range"
                                    type="range"
                                    min={2}
                                    max={36}
                                    value={term}
                                    onChange={(e) => setTerm(Number(e.target.value))}
                                    aria-label="Срок реализации"
                                />
                                {calc.rush > 1 && (
                                    <small style={{ color: 'var(--rt-orange)', fontSize: 12 }}>
                                        Сжатые сроки: наценка за срочность +{Math.round((calc.rush - 1) * 100)}%
                                    </small>
                                )}
                            </div>

                            <div className="dc-field full">
                                <span className="dc-label">Виды работ</span>
                                <div className="dc-chips">
                                    {WORKS.map((w) => (
                                        <button
                                            key={w.id}
                                            type="button"
                                            className={`dc-chip ${works.includes(w.id) ? 'on' : ''}`}
                                            onClick={() => toggleWork(w.id)}
                                        >
                                            {w.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dc-panel">
                        <h3>
                            <Package size={16} color="#7700FF" /> Оборудование
                        </h3>
                        <p className="dc-sub">
                            <RefreshCw size={11} style={{ verticalAlign: -1 }} /> Цены собраны парсером из прайс-листов, обновлено {PRICE_DATE}
                        </p>
                        <div className="dc-items">
                            {EQUIPMENT.map((e) => (
                                <div key={e.id} className={`dc-item ${equipQty[e.id] > 0 ? 'on' : ''}`}>
                                    <div style={{ minWidth: 0 }}>
                                        <b>{e.name}</b>
                                        <small>
                                            {fmtRub(e.price)} · {e.source}
                                        </small>
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        value={equipQty[e.id] || 0}
                                        aria-label={`Количество: ${e.name}`}
                                        onChange={(ev) =>
                                            setEquipQty((p) => ({ ...p, [e.id]: Math.max(0, Number(ev.target.value) || 0) }))
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="dc-panel">
                        <h3>
                            <Package size={16} color="#FF4F12" /> Программное обеспечение
                        </h3>
                        <p className="dc-sub">Лицензии и подписки по актуальным прайсам вендоров</p>
                        <div className="dc-items">
                            {SOFTWARE.map((s) => (
                                <div key={s.id} className={`dc-item ${softQty[s.id] > 0 ? 'on' : ''}`}>
                                    <div style={{ minWidth: 0 }}>
                                        <b>{s.name}</b>
                                        <small>
                                            {fmtRub(s.price)} · {s.source}
                                        </small>
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        value={softQty[s.id] || 0}
                                        aria-label={`Количество: ${s.name}`}
                                        onChange={(ev) =>
                                            setSoftQty((p) => ({ ...p, [s.id]: Math.max(0, Number(ev.target.value) || 0) }))
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ─── Правая колонка: результат ─── */}
                <div className="dc-col dc-sticky">
                    <div className="dc-panel" style={{ borderLeft: '4px solid var(--rt-orange)' }}>
                        <h3>
                            <Scale size={16} color="#FF4F12" /> Ценовая «вилка»
                        </h3>
                        <p className="dc-sub">Диапазон цены на основе аналогичных проектов и стоимости компонентов</p>

                        <div className="dc-fork-track">
                            <div className="dc-fork-mark" style={{ left: '0%' }}>
                                <b>{fmtMln(calc.min)}</b>минимум
                            </div>
                            <div className="dc-fork-mark opt" style={{ left: `${forkPos(calc.opt)}%` }}>
                                <b>{fmtMln(calc.opt)}</b>оптимум
                            </div>
                            <div className="dc-fork-mark" style={{ left: '100%', transform: 'translateX(-90%)' }}>
                                <b>{fmtMln(calc.max)}</b>максимум
                            </div>
                        </div>

                        <div className="dc-kpis">
                            <div className="dc-kpi main">
                                <small>Оптимальная цена</small>
                                <b>{fmtMln(calc.opt)}</b>
                            </div>
                            <div className="dc-kpi">
                                <small>Маржа при оптимуме</small>
                                <b>{calc.marginOpt.toFixed(1)}%</b>
                            </div>
                            <div className="dc-kpi">
                                <small>Себестоимость</small>
                                <b>{fmtMln(calc.costMln)}</b>
                            </div>
                        </div>

                        <div className="dc-cost">
                            <div>
                                <span>Работы ({works.length} видов)</span>
                                <span>{fmtMln(calc.worksMln)}</span>
                            </div>
                            <div>
                                <span>Оборудование</span>
                                <span>{fmtMln(calc.equipMln)}</span>
                            </div>
                            <div>
                                <span>Программное обеспечение</span>
                                <span>{fmtMln(calc.softMln)}</span>
                            </div>
                            <div style={{ borderBottom: 'none' }}>
                                <span>
                                    <b>Итого по компонентам</b>
                                </span>
                                <span>
                                    <b>{fmtMln(calc.totalMln)}</b>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Дашборд ─── */}
            <div className="dc-panel">
                <h3>
                    <BarChart3 size={16} color="#7700FF" /> Дашборд: маржинальность и сравнение с аналогами
                </h3>
                <p className="dc-sub">
                    Ваш оптимум {avgDiff >= 0 ? 'выше' : 'ниже'} средней цены аналогов на{' '}
                    <b style={{ color: 'var(--rt-orange)' }}>{Math.abs(avgDiff).toFixed(1)}%</b> (на основе ретроданных)
                </p>

                <div className="dc-charts">
                    {/* Маржинальность */}
                    <div>
                        <div className="dc-label" style={{ marginBottom: 8 }}>
                            <TrendingUp size={12} style={{ verticalAlign: -1 }} /> Маржинальность по сценариям, %
                        </div>
                        <svg className="dc-svg" viewBox="0 0 300 200" role="img" aria-label="График маржинальности">
                            {[0, 10, 20, 30, 40].map((g) => {
                                const y = 160 - (g / chartMax) * 140;
                                return (
                                    <g key={g}>
                                        <line x1="30" x2="290" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                        <text x="24" y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                                            {g}
                                        </text>
                                    </g>
                                );
                            })}
                            {bars.map((b, i) => {
                                const h = (Math.max(b.value, 0) / chartMax) * 140;
                                const x = 52 + i * 80;
                                return (
                                    <g key={b.label}>
                                        <rect x={x} y={160 - h} width="50" height={h} rx="5" fill={b.color} />
                                        <text x={x + 25} y={160 - h - 6} fontSize="11" fontWeight="700" fill="#1a1a1a" textAnchor="middle">
                                            {b.value.toFixed(1)}%
                                        </text>
                                        <text x={x + 25} y="178" fontSize="10" fill="#475569" textAnchor="middle">
                                            {b.label}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* Сравнение с аналогами */}
                    <div>
                        <div className="dc-label" style={{ marginBottom: 8 }}>
                            <BarChart3 size={12} style={{ verticalAlign: -1 }} /> Сравнение с аналогичными проектами
                        </div>
                        {analogRows.map((r) => {
                            const a = analogs.find((x) => x.name === r.name);
                            return (
                                <div key={r.name} className={`dc-an-row ${r.me ? 'me' : ''}`}>
                                    <span title={a ? `${a.year}, маржа ${a.margin}%` : undefined}>{r.name}</span>
                                    <div className="dc-an-bar">
                                        <i style={{ width: `${(r.price / maxAnalog) * 100}%` }} />
                                    </div>
                                    <span>{fmtMln(r.price)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ─── КП ─── */}
            <div className="dc-panel">
                <h3>
                    <FileText size={16} color="#7700FF" /> Шаблон коммерческого предложения
                </h3>
                <p className="dc-sub">Подставляются параметры проекта и ценовая «вилка»</p>

                <div className="dc-field" style={{ marginBottom: 12, maxWidth: 420 }}>
                    <label htmlFor="dc-customer">Заказчик</label>
                    <input
                        id="dc-customer"
                        type="text"
                        placeholder="Например, ООО «Ромашка»"
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                    />
                </div>

                <div className="dc-kp">{kpText}</div>

                <div className="dc-actions">
                    <button type="button" className="btn btn-primary" onClick={downloadDoc}>
                        <Download size={15} /> Скачать КП (.doc)
                    </button>
                    <button type="button" className="btn btn-outline" onClick={copyKp}>
                        <ClipboardCopy size={15} /> {copied ? 'Скопировано ✓' : 'Копировать текст'}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={reset}>
                        <RefreshCw size={15} /> Сбросить параметры
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DealCalculator;
