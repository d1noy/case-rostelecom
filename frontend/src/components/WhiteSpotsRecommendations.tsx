import React from 'react';
import { RegionItem } from '../data/mockData';
import { Sparkles, ArrowRight, TrendingUp, Users, Target } from 'lucide-react';

interface WhiteSpotsRecommendationsProps {
    regions: RegionItem[];
    onSelectRegion: (reg: RegionItem) => void;
    onOpenCompanies: (reg: RegionItem) => void;
}

export const WhiteSpotsRecommendations: React.FC<WhiteSpotsRecommendationsProps> = ({
                                                                                        regions,
                                                                                        onSelectRegion,
                                                                                        onOpenCompanies,
                                                                                    }) => {
    // Filter top 3 highest headroom white spots
    const topWhiteSpots = [...regions]
        .filter((r) => r.is_white_spot)
        .sort((a, b) => b.headroom_revenue_mln - a.headroom_revenue_mln)
        .slice(0, 3);

    if (topWhiteSpots.length === 0) return null;

    return (
        <div
            style={{
                background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
                border: '1.5px solid #fed7aa',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 4px 14px rgba(255, 79, 18, 0.08)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div
                    style={{
                        background: 'var(--rt-orange)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Sparkles size={18} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#9a3412' }}>
                        ТОП-3 целевых «Белых пятна» для скоринговой экспансии РТК
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#c2410c' }}>
                        Максимальная свободная емкость рынка (Headroom Revenue) при низкой конкуренции провайдеров
                    </p>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '14px',
                }}
            >
                {topWhiteSpots.map((spot, idx) => (
                    <div
                        key={spot.id}
                        style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #fed7aa',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        }}
                    >
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span
                    style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#fff',
                        background: 'var(--rt-orange)',
                        padding: '2px 7px',
                        borderRadius: '4px',
                    }}
                >
                  #{idx + 1} Приоритет
                </span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  Скоринг: <b>{spot.score}/100</b>
                </span>
                            </div>

                            <h4 style={{ margin: '0 0 6px 0', fontSize: '14.5px', fontWeight: 800, color: 'var(--rt-dark)' }}>
                                {spot.name}
                            </h4>

                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                                Отраслевой фокус: <b>{spot.industry}</b>
                            </div>

                            <div style={{ background: '#fff7ed', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9a3412' }}>
                                    <span>Свободная емкость:</span>
                                    <b>~{spot.headroom_revenue_mln} млн ₽</b>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9a3412', marginTop: '2px' }}>
                                    <span>Неохваченных лидов:</span>
                                    <b>+{spot.potential_count} компаний</b>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={() => onSelectRegion(spot)}
                                className="btn btn-outline"
                                style={{ flex: 1, padding: '6px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                                <span>На карте</span>
                                <ArrowRight size={12} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpenCompanies(spot)}
                                className="btn btn-primary"
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    fontSize: '11.5px',
                                    background: 'var(--rt-orange)',
                                    border: 'none',
                                }}
                            >
                                Лиды ({spot.potential_count})
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
