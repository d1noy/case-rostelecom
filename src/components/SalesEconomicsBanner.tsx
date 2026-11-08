import React from 'react';
import { TrendingUp, DollarSign, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface SalesEconomicsBannerProps {
    headroomMln: number;
}

export const SalesEconomicsBanner: React.FC<SalesEconomicsBannerProps> = ({ headroomMln }) => {
    return (
        <div
            style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px 24px',
                marginTop: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(119, 0, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--rt-purple)',
                        }}
                    >
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--rt-dark)' }}>
                            Экономика B2B-продаж по сегменту «Белые пятна» (Слайд 6 ТЗ)
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--rt-muted)' }}>
                            Расчет ключевых метрик окупаемости при подключении корпоративных клиентов
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                    <ShieldCheck size={14} />
                    <span>Финансовая модель верифицирована</span>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '14px',
                }}
            >
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>LTV (Пожизненная ценность)</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--rt-purple)', marginTop: '2px' }}>
                        ~1.42 млн ₽
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Средний контракт на 36 месяцев</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>CAC (Стоимость привлечения)</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        118 000 ₽
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Включая скоринг и выезд инженера</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Окупаемость сделки (Payback)</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--rt-orange)', marginTop: '2px' }}>
                        4.2 мес.
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Высокая маржинальность ВОЛС/IaaS</div>
                </div>

                <div style={{ background: '#fff7ed', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: '11.5px', color: '#9a3412', fontWeight: 600 }}>Совокупный Headroom</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#c2410c', marginTop: '2px' }}>
                        {new Intl.NumberFormat('ru-RU').format(headroomMln)} млн ₽
                    </div>
                    <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '2px' }}>Свободная емкость в текущей выборке</div>
                </div>
            </div>
        </div>
    );
};
