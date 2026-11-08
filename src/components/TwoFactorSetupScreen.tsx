import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  Download,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Lock,
  Smartphone,
  Eye,
  Trash2,
} from 'lucide-react';

interface TwoFactorSetupScreenProps {
  onSuccess: () => void;
  currentUserEmail?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export const TwoFactorSetupScreen: React.FC<TwoFactorSetupScreenProps> = ({
  onSuccess,
  currentUserEmail = 'test@example.com',
  isModal = false,
  onClose,
}) => {
  // Step state: 'initial' | 'qr_confirm' | 'confirmed'
  const [step, setStep] = useState<'initial' | 'qr_confirm' | 'confirmed'>('initial');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedCodes, setCopiedCodes] = useState<boolean>(false);

  // Check initial user 2FA status
  useEffect(() => {
    fetch('/api/user', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.two_factor_confirmed) {
            setStep('confirmed');
            loadRecoveryCodes();
          } else if (data.two_factor_enabled) {
            setStep('qr_confirm');
            loadQrAndSecret();
          } else {
            setStep('initial');
          }
        }
      })
      .catch(() => {
        setStep('initial');
      });
  }, []);

  const loadQrAndSecret = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [qrRes, keyRes] = await Promise.all([
        fetch('/user/two-factor-qr-code', { credentials: 'include' }),
        fetch('/user/two-factor-secret-key', { credentials: 'include' }),
      ]);

      if (qrRes.ok) {
        const qrJson = await qrRes.json();
        setQrSvg(qrJson.svg || '');
      }

      if (keyRes.ok) {
        const keyJson = await keyRes.json();
        setSecretKey(keyJson.secretKey || '');
      }
    } catch (err) {
      setErrorMessage('Не удалось загрузить QR-код. Проверьте соединение с сервером.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecoveryCodes = async () => {
    try {
      const res = await fetch('/user/two-factor-recovery-codes', { credentials: 'include' });
      if (res.ok) {
        const codes = await res.json();
        setRecoveryCodes(codes);
      }
    } catch {
      // silent
    }
  };

  // Step 1: Initialize 2FA via Fortify POST /user/two-factor-authentication
  const handleEnableTwoFactor = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Ensure CSRF cookie first per Sanctum standard
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

      const res = await fetch('/user/two-factor-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Ошибка включения двухфакторной аутентификации');
      }

      setStep('qr_confirm');
      await loadQrAndSecret();
    } catch (err: any) {
      setErrorMessage(err.message || 'Сбой инициализации 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Confirm OTP code via Fortify POST /user/confirmed-two-factor-authentication
  const handleConfirmOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage('Введите 6-значный одноразовый код подтверждения');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/user/confirmed-two-factor-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: otpCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.errors?.code?.[0] || data.message || 'Неверный код подтверждения';
        setErrorMessage(msg);
        return;
      }

      // Success: 2FA confirmed and active!
      setStep('confirmed');
      await loadRecoveryCodes();
    } catch {
      setErrorMessage('Не удалось связаться с сервером. Повторите попытку.');
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate recovery codes via Fortify POST /user/two-factor-recovery-codes
  const handleRegenerateCodes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/user/two-factor-recovery-codes', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const codes = await res.json();
        setRecoveryCodes(codes);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  // Disable 2FA via Fortify DELETE /user/two-factor-authentication (for testing 403 lock)
  const handleDisableTwoFactor = async () => {
    if (!window.confirm('Вы уверены, что хотите отключить 2FA? Маршруты /api/regions будут снова заблокированы (403).')) {
      return;
    }
    setIsLoading(true);
    try {
      await fetch('/user/two-factor-authentication', {
        method: 'DELETE',
        credentials: 'include',
      });
      setStep('initial');
      setOtpCode('');
      setSecretKey('');
      setQrSvg('');
      setRecoveryCodes([]);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleDownloadRecoveryCodes = () => {
    const text = `РЕЗЕРВНЫЕ КОДЫ ДВУХФАКТОРНОЙ АУТЕНТИФИКАЦИИ\nПАО «Ростелеком» • Аккаунт: ${currentUserEmail}\nДата: ${new Date().toLocaleString('ru-RU')}\n\n${recoveryCodes.join('\n')}\n\nХраните эти коды в безопасном месте. Каждый код может быть использован один раз.`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rostelecom_2fa_recovery_codes_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={
        isModal
          ? {
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.65)',
              zIndex: 3500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backdropFilter: 'blur(4px)',
            }
          : {
              maxWidth: '860px',
              margin: '24px auto',
              padding: '0 16px',
            }
      }
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0',
          width: '100%',
          maxWidth: isModal ? '720px' : '100%',
          maxHeight: isModal ? '90vh' : 'none',
          overflowY: 'auto',
          padding: '28px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: step === 'confirmed' ? '#ecfdf5' : '#fff7ed',
                border: `1.5px solid ${step === 'confirmed' ? '#a7f3d0' : '#fed7aa'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: step === 'confirmed' ? '#059669' : 'var(--rt-orange)',
              }}
            >
              {step === 'confirmed' ? <ShieldCheck size={26} /> : <ShieldAlert size={26} />}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--rt-dark)' }}>
                {step === 'confirmed' ? 'Двухфакторная аутентификация активна' : 'Настройка двухфакторной аутентификации (2FA)'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: '3px 0 0' }}>
                Laravel Fortify • ПАО «Ростелеком» • Аккаунт: <b>{currentUserEmail}</b>
              </p>
            </div>
          </div>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#9ca3af',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 403 Forbidden Lock Banner (when not confirmed) */}
        {step !== 'confirmed' && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <Lock size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#991b1b' }}>
                Доступ к маршрутам /api/regions заблокирован (HTTP 403 Forbidden)
              </div>
              <div style={{ fontSize: '12.5px', color: '#7f1d1d', marginTop: '3px', lineHeight: 1.45 }}>
                В соответствии с политикой информационной безопасности, аналитические данные Модуля 1 («Радар присутствия»)
                доступны только авторизованным пользователям с подтвержденной двухфакторной аутентификацией.
              </div>
            </div>
          </div>
        )}

        {/* Error message alert */}
        {errorMessage && (
          <div
            style={{
              background: '#fff1f2',
              border: '1px solid #fda4af',
              borderRadius: '6px',
              padding: '12px 14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#be123c',
              fontSize: '13px',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: INITIAL (Not Enabled) */}
        {step === 'initial' && (
          <div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
                Как это работает:
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Smartphone size={20} color="var(--rt-purple)" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '12.5px', color: '#475569' }}>
                    <b>1. Любое приложение:</b> Google Authenticator, Яндекс Ключ, 1Password или Microsoft Authenticator.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <QrCode size={20} color="var(--rt-orange)" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '12.5px', color: '#475569' }}>
                    <b>2. Сканирование QR:</b> Отсканируйте код или скопируйте секретный ключ.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '12.5px', color: '#475569' }}>
                    <b>3. Разблокировка:</b> Мгновенное открытие доступа к эндпоинтам и карте регионов.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={isLoading}
              onClick={handleEnableTwoFactor}
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Инициализация 2FA...</span>
                </>
              ) : (
                <>
                  <KeyRound size={18} />
                  <span>Включить двухфакторную аутентификацию (POST /user/two-factor-authentication)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: QR & OTP CONFIRMATION */}
        {step === 'qr_confirm' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: qrSvg ? '260px 1fr' : '1fr', gap: '24px', alignItems: 'center', marginBottom: '24px' }}>
              {/* QR Code Container */}
              {qrSvg && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%',
                      maxHeight: '220px',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--rt-muted)', marginTop: '8px', fontWeight: 500 }}>
                    Отсканируйте в Google Authenticator / 1Password
                  </div>
                </div>
              )}

              {/* Instructions & Secret Key */}
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rt-dark)', margin: '0 0 8px' }}>
                  Шаг 1. Отсканируйте QR-код или введите ключ вручную
                </h4>
                <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Откройте приложение аутентификации на смартфоне и наведите камеру на QR-код.
                  Если камера недоступна, используйте секретный ключ ниже:
                </p>

                {/* Secret Key Display */}
                {secretKey && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--rt-muted)', display: 'block', marginBottom: '4px' }}>
                      Секретный ключ (Secret Key):
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        gap: '8px',
                      }}
                    >
                      <code
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          fontWeight: 700,
                          letterSpacing: '2px',
                          color: 'var(--rt-dark)',
                          flex: 1,
                        }}
                      >
                        {secretKey}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="btn btn-outline"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {copiedKey ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{copiedKey ? 'Скопировано' : 'Копировать'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* OTP Input Form */}
                <form onSubmit={handleConfirmOtp}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                    Шаг 2. Введите 6-значный одноразовый OTP-код:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Например: 123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      style={{
                        padding: '10px 14px',
                        fontSize: '18px',
                        fontWeight: 700,
                        letterSpacing: '4px',
                        textAlign: 'center',
                        borderRadius: '6px',
                        border: '1.5px solid #cbd5e1',
                        width: '180px',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isLoading || otpCode.length < 6}
                      style={{
                        flex: 1,
                        padding: '10px 18px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Проверка...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>Подтвердить код (POST)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Demo test helper button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setOtpCode('123456')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--rt-purple)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      💡 Подставить тестовый код 123456
                    </button>

                    <button
                      type="button"
                      onClick={handleDisableTwoFactor}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMED & ACTIVE (Recovery Codes) */}
        {step === 'confirmed' && (
          <div>
            <div
              style={{
                background: '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <CheckCircle2 size={24} color="#059669" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#065f46' }}>
                  Двухфакторная аутентификация успешно подтверждена!
                </div>
                <div style={{ fontSize: '13px', color: '#047857', marginTop: '2px' }}>
                  Все эндпоинты <b>/api/regions</b> разблокированы. Учетная запись надежно защищена.
                </div>
              </div>
            </div>

            {/* Recovery Codes Section */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '18px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                    Резервные коды восстановления (Recovery Codes)
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                    Сохраните эти коды на случай утери доступа к мобильному аутентификатору:
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleCopyRecoveryCodes}
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCodes ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    <span>{copiedCodes ? 'Скопировано' : 'Копировать'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadRecoveryCodes}
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Download size={13} />
                    <span>Скачать (.txt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRegenerateCodes}
                    className="btn btn-outline"
                    disabled={isLoading}
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Сгенерировать новый набор кодов"
                  >
                    <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                    <span>Обновить</span>
                  </button>
                </div>
              </div>

              {/* Codes Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '12px',
                }}
              >
                {recoveryCodes.length > 0 ? (
                  recoveryCodes.map((code, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: '#334155',
                        background: '#f1f5f9',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textAlign: 'center',
                        letterSpacing: '1px',
                      }}
                    >
                      {code}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', gridColumn: '1 / -1' }}>
                    Загрузка кодов восстановления...
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action Button to Unlock Dashboard */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSuccess}
                style={{
                  flex: 2,
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, var(--rt-purple) 0%, #9333ea 100%)',
                }}
              >
                <span>Перейти к Радару присутствия (Модуль 1)</span>
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={handleDisableTwoFactor}
                className="btn btn-outline"
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                title="Отключить 2FA для проверки блокировки маршрутов 403"
              >
                <Trash2 size={14} />
                <span>Отключить 2FA (Тест 403)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
