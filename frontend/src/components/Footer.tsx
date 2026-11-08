import React from 'react';
import { ShieldCheck, Server, Lock } from 'lucide-react';
import { getApiBaseUrl } from '../api/client';

export const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const apiBase = getApiBaseUrl();

    return (
        <footer
            style={{
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '24px 0',
                marginTop: '40px',
                fontSize: '12px',
                color: '#64748b',
            }}
        >
            <div
                className="container"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                }}
            >
                <div>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>
            ПАО «Ростелеком»
          </span>{' '}
                    • Платформа геоаналитики «Радар присутствия» © {currentYear}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Lock size={13} color="var(--rt-purple)" />
            Авторизация: <b>Laravel Sanctum (Bearer Token)</b>
          </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={13} color="#059669" />
            2FA: <b>Fortify TOTP / Recovery Codes</b>
          </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Server size={13} color="#64748b" />
            Шлюз: <code>{apiBase}</code>
          </span>
                </div>
            </div>
        </footer>
    );
};
