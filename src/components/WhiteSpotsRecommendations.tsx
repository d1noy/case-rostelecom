import React from 'react';
import { RegionItem } from '../data/mockData';

interface WhiteSpotsRecommendationsProps {
  regions: RegionItem[];
  onSelectRegion: (region: RegionItem) => void;
  onOpenCompanies: (region: RegionItem) => void;
}

export const WhiteSpotsRecommendations: React.FC<WhiteSpotsRecommendationsProps> = ({
  regions,
  onSelectRegion,
  onOpenCompanies,
}) => {
  // Sort by score descending to get top white spots
  const topWhiteSpots = [...regions]
    .filter((r) => r.is_white_spot)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (topWhiteSpots.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px var(--shadow)', borderTop: '4px solid var(--rt-orange)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rt-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎯 ТОП-3 «Белых пятна» для коммерческого директора</span>
            <span style={{ fontSize: '11px', background: 'rgba(255, 79, 18, 0.15)', color: 'var(--rt-orange)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              AI Скоринг рынка
            </span>
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: 0 }}>
            Локации с максимальной емкостью коммерческого рынка при минимальном покрытии контрактами РТК
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {topWhiteSpots.map((spot, idx) => (
          <div
            key={spot.id}
            style={{
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              background: '#fff7ed',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--rt-dark)' }}>
                  #{idx + 1} {spot.name}
                </span>
                <span
                  style={{
                    background: spot.priority_grade === 'A+' ? '#ea580c' : '#f97316',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {spot.priority_grade} ({spot.score}/100)
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>
                Отрасль-драйвер: <b>{spot.industry}</b>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#666', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Свободная емкость:</span>
                  <b style={{ color: 'var(--rt-purple)' }}>{spot.headroom_revenue_mln} млн ₽</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Неохваченных компаний:</span>
                  <b style={{ color: 'var(--rt-orange)' }}>+{spot.potential_count} ед.</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Текущий охват РТК:</span>
                  <b>{spot.coverage_percent}% (критически низкий)</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, padding: '6px 8px', fontSize: '12px', borderColor: '#fdba74' }}
                onClick={() => onSelectRegion(spot)}
              >
                Показать на карте
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '6px 8px', fontSize: '12px', background: 'var(--rt-orange)' }}
                onClick={() => onOpenCompanies(spot)}
              >
                Реестр лидов →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
