import React from 'react';
import { Clock, TrendingUp, Target, Zap, ShieldCheck } from 'lucide-react';

interface SalesEconomicsBannerProps {
  headroomMln: number;
}

export const SalesEconomicsBanner: React.FC<SalesEconomicsBannerProps> = ({ headroomMln }) => {
  return (
    <div
      style={{
        marginTop: '24px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)',
        border: '1.5px solid #e9d5ff',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(119, 0, 255, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: 'var(--rt-purple)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
            </span>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rt-dark)', margin: 0 }}>
              Экономический эффект внедрения «Радара присутствия» для B2B продаж
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: '4px 0 0' }}>
            Прямое влияние гео-аналитической системы на операционную эффективность коммерческого блока ПАО «Ростелеком»
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        {/* Item 1 */}
        <div style={{ background: '#fff', padding: '14px', borderRadius: '6px', border: '1px solid #f3e8ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rt-purple)', marginBottom: '6px' }}>
            <Clock size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Время сбора базы</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1f2937' }}>
            15 минут <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>вместо 4 дней</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Автоматический отбор платежеспособных юрлиц по открытым данным ФНС и кадастра.
          </div>
        </div>

        {/* Item 2 */}
        <div style={{ background: '#fff', padding: '14px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rt-orange)', marginBottom: '6px' }}>
            <TrendingUp size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Свободная емкость</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--rt-orange)' }}>
            +{new Intl.NumberFormat('ru-RU').format(headroomMln)} млн ₽
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Объем целевого пайплайна в выявленных «белых пятнах» без конкуренции РТК.
          </div>
        </div>

        {/* Item 3 */}
        <div style={{ background: '#fff', padding: '14px', borderRadius: '6px', border: '1px solid #f3e8ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rt-purple)', marginBottom: '6px' }}>
            <Target size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Точность оффера</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1f2937' }}>
            +38% <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>к конверсии</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Готовые пакетные предложения формируются под конкретную отрасль бизнеса.
          </div>
        </div>

        {/* Item 4 */}
        <div style={{ background: '#fff', padding: '14px', borderRadius: '6px', border: '1px solid #f3e8ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rt-purple)', marginBottom: '6px' }}>
            <Zap size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Цикл сделки</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1f2937' }}>
            -14 дней <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>быстрее выход</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Моментальная выгрузка КП (.doc) и загрузка реестра лидов в CRM сейлз-команды.
          </div>
        </div>
      </div>
    </div>
  );
};
