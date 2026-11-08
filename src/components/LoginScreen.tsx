import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { authService, UserProfile } from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // Step 1: Credentials | Step 2: 2FA Challenge OTP
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  // Form fields
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('ChangeMe_123!');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // 2FA state
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState<number>(300);

  // UX states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // References for OTP input focus
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown for challenge expiration
  useEffect(() => {
    let timer: any = null;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setErrorMessage('Время действия сессии 2FA истекло. Пожалуйста, войдите снова.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Focus first OTP field when entering step 2
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Handle Step 1: POST /auth/login
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Пожалуйста, введите логин и пароль.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.login(username.trim(), password);

      if (response.two_factor_required && response.challenge) {
        setChallengeToken(response.challenge);
        setCountdown(response.expires_in || 300);
        setOtpDigits(['', '', '', '', '', '']);
        setStep('otp');
        setInfoMessage(response.message || 'Введите 6-значный код из аутентификатора');
      } else {
        setErrorMessage('Двухфакторная аутентификация обязательна для входа.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Неверный логин или пароль.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: POST /auth/2fa/verify
  const handleVerifySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const fullCode = otpDigits.join('').trim();
    if (fullCode.length !== 6) {
      setErrorMessage('Введите полный 6-значный код подтверждения.');
      return;
    }

    if (countdown === 0) {
      setErrorMessage('Срок действия challenge истёк. Пожалуйста, вернитесь назад и выполните вход заново.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.verify2fa(challengeToken, fullCode);
      onLoginSuccess(res.access_token, res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Неверный код подтверждения.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP inputs handling
  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric characters
    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Pasted string
      const pastedDigits = cleanVal.slice(0, 6).split('');
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newDigits[i] = digit;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(5, pastedDigits.length);
      otpInputRefs.current[nextIdx]?.focus();

      if (newDigits.every((d) => d !== '')) {
        setTimeout(() => {
          verifyDirectly(newDigits.join(''));
        }, 100);
      }
      return;
    }

    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto-advance
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 filled
    if (index === 5 && cleanVal && newDigits.every((d) => d !== '')) {
      setTimeout(() => {
        verifyDirectly(newDigits.join(''));
      }, 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const verifyDirectly = async (code: string) => {
    if (countdown === 0) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await authService.verify2fa(challengeToken, code);
      onLoginSuccess(res.access_token, res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Неверный код подтверждения.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format seconds to mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d121f 0%, #171e31 50%, #111827 100%)',
        padding: '24px 16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Background ambient lighting accents */}
      <div
        style={{
          position: 'fixed',
          top: '-15%',
          left: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-10%',
          right: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(235, 87, 87, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(90deg, #7c3aed 0%, #ea580c 100%)',
            height: '5px',
            width: '100%',
          }}
        />

        <div style={{ padding: '32px 32px 28px' }}>
          {/* Brand header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #ea580c 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '11px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                РОСТЕЛЕКОМ
              </div>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Коммерческий блок</span>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                color: '#059669',
                background: '#ecfdf5',
                padding: '3px 8px',
                borderRadius: '12px',
                fontWeight: 600,
              }}
            >
              <Shield size={12} />
              <span>2FA Secured</span>
            </div>
          </div>

          {/* Error & Info Alerts */}
          {errorMessage && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '13px',
                color: '#b91c1c',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {infoMessage && !errorMessage && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#15803d',
              }}
            >
              <CheckCircle2 size={16} />
              <div>{infoMessage}</div>
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === 'credentials' && (
            <div>
              <div style={{ marginBottom: '22px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                  Вход в систему
                </h1>
                <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                  Авторизуйтесь для доступа к гео-аналитике и радару присутствия
                </p>
              </div>

              {/* Quick Fill Demo Helper Button */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  Тестовый аккаунт: <strong style={{ color: '#0f172a' }}>admin</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('ChangeMe_123!');
                    setErrorMessage(null);
                  }}
                  style={{
                    background: '#e0e7ff',
                    border: 'none',
                    color: '#4338ca',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={12} />
                  Заполнить данные
                </button>
              </div>

              <form onSubmit={handleLoginSubmit}>
                {/* Username Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="username"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Имя пользователя
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                        display: 'flex',
                      }}
                    >
                      <User size={18} />
                    </div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      required
                      autoComplete="username"
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 38px',
                        fontSize: '14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div style={{ marginBottom: '22px' }}>
                  <label
                    htmlFor="password"
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Пароль
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                        display: 'flex',
                      }}
                    >
                      <Lock size={18} />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="current-password"
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 38px',
                        fontSize: '14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 0,
                      }}
                      title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: isLoading
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #7c3aed 0%, #ea580c 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                    transition: 'opacity 0.2s, transform 0.1s',
                  }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Проверка учетных данных...</span>
                    </>
                  ) : (
                    <>
                      <span>Войти в систему</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {/* Informational notice */}
              <div
                style={{
                  marginTop: '22px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '12px',
                  color: '#64748b',
                  lineHeight: '1.5',
                  textAlign: 'center',
                }}
              >
                Регистрация пользователей не предусмотрена.
                <br />
                Учётные записи создаются системным администратором.
              </div>
            </div>
          )}

          {/* STEP 2: 2FA CHALLENGE OTP */}
          {step === 'otp' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#7c3aed',
                    background: '#f5f3ff',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '10px',
                  }}
                >
                  <KeyRound size={14} />
                  <span>Шаг 2 из 2: Защита Fortify 2FA</span>
                </div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                  Код подтверждения
                </h1>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                  Введите 6-значный одноразовый OTP-код из приложения-аутентификатора для пользователя{' '}
                  <strong style={{ color: '#0f172a' }}>{username}</strong>.
                </p>
              </div>

              {/* Timer Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: countdown > 30 ? '#f8fafc' : '#fff1f2',
                  border: `1px solid ${countdown > 30 ? '#e2e8f0' : '#fecdd3'}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '18px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <Clock size={14} color={countdown > 30 ? '#64748b' : '#e11d48'} />
                  <span>Срок действия сессии:</span>
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: countdown > 30 ? '#0f172a' : '#e11d48',
                  }}
                >
                  {formatTimer(countdown)}
                </div>
              </div>

              {/* 6 Digit Input Grid */}
              <div style={{ marginBottom: '18px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      disabled={isLoading || countdown === 0}
                      style={{
                        width: '48px',
                        height: '56px',
                        textAlign: 'center',
                        fontSize: '22px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        border: digit ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                        borderRadius: '8px',
                        background: digit ? '#faf5ff' : '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Test code quick insertion helper */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  Тестовый код: <strong style={{ color: '#0f172a', letterSpacing: '1px' }}>123456</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const testDigits = ['1', '2', '3', '4', '5', '6'];
                    setOtpDigits(testDigits);
                    verifyDirectly('123456');
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#7c3aed',
                    cursor: 'pointer',
                  }}
                >
                  Вставить и войти
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleVerifySubmit()}
                  disabled={isLoading || countdown === 0 || otpDigits.join('').length !== 6}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: '#ffffff',
                    background:
                      isLoading || countdown === 0 || otpDigits.join('').length !== 6
                        ? '#94a3b8'
                        : 'linear-gradient(135deg, #7c3aed 0%, #ea580c 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor:
                      isLoading || countdown === 0 || otpDigits.join('').length !== 6
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                  }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Подтверждение токена...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Подтвердить и войти</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#64748b',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Вернуться к вводу логина</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
