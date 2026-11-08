import React from 'react';
import { ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';

interface HeaderProps {
  currentUser: string;
  currentUserEmail?: string;
  isTwoFactorConfirmed?: boolean;
  onOpen2FA?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  currentUserEmail = 'test@example.com',
  isTwoFactorConfirmed = false,
  onOpen2FA,
  onLogout,
}) => {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="logo-wrapper">
          <div className="logo-badge">
            РОСТЕЛЕКОМ
          </div>
          <span className="logo-text">Коммерческий блок</span>
        </div>

        <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#16a34a',
              }}
              title="Активная сессия"
            />
            <span style={{ color: 'var(--rt-muted)', fontSize: '13px' }}>
              <b style={{ color: 'var(--rt-dark)' }}>{currentUser}</b> ({currentUserEmail})
            </span>
          </div>

          {/* 2FA Status Badge */}
          {onOpen2FA && (
            <button
              type="button"
              onClick={onOpen2FA}
              className="btn btn-outline"
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '16px',
                borderColor: isTwoFactorConfirmed ? '#a7f3d0' : '#fed7aa',
                background: isTwoFactorConfirmed ? '#ecfdf5' : '#fff7ed',
                color: isTwoFactorConfirmed ? '#065f46' : '#c2410c',
              }}
              title="Настройки двухфакторной аутентификации Fortify"
            >
              {isTwoFactorConfirmed ? (
                <>
                  <ShieldCheck size={14} color="#059669" />
                  <span>2FA активна</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={14} color="#ea580c" />
                  <span>2FA отключена</span>
                </>
              )}
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {onLogout && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '12.5px', color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={onLogout}
              >
                Выйти
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
