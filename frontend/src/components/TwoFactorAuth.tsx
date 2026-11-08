import React, { useState, useRef, useEffect } from 'react';

interface TwoFactorAuthProps {
  onSuccess: (userName: string) => void;
  onCancel?: () => void;
  isOpen: boolean;
}

export const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ onSuccess, onCancel, isOpen }) => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('ivanov.ii@rt.ru');
  const [password, setPassword] = useState('••••••••••••');
  const [otp, setOtp] = useState(['2', '0', '2', '6']);
  const [timer, setTimer] = useState(45);
  const [errorMsg, setErrorMsg] = useState('');

  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isOpen) return null;

  const handleNextToOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Введите корпоративную почту');
      return;
    }
    setErrorMsg('');
    setStep('otp');
    setTimer(45);
    setTimeout(() => {
      inputRefs[0].current?.focus();
    }, 100);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto advance focus
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = () => {
    const code = otp.join('');
    if (code.length < 4) {
      setErrorMsg('Введите 4 цифры кода подтверждения');
      return;
    }
    setErrorMsg('');
    onSuccess('Иванов И.И.');
  };

  return (
    <div className="login-screen" style={{ backdropFilter: 'blur(4px)', background: 'rgba(26,26,26,0.6)' }}>
      <div className="login-card" style={{ background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div className="logo-badge" style={{ width: '130px', height: '36px', fontSize: '14px' }}>
            РОСТЕЛЕКОМ
          </div>
        </div>

        <h2 className="login-title" style={{ fontSize: '20px', marginBottom: '8px' }}>
          Экосистема коммерческого блока
        </h2>
        <p style={{ color: 'var(--rt-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Защищенный корпоративный контур (Требование 2FA)
        </p>

        {errorMsg && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
            {errorMsg}
          </div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleNextToOtp}>
            <div className="input-group">
              <label>Корпоративный логин / E-mail</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@rt.ru"
              />
            </div>

            <div className="input-group">
              <label>Пароль доступа</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }}>
              Получить одноразовый код (2FA) →
            </button>
          </form>
        ) : (
          <div>
            <div style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--rt-dark)' }}>
              SMS-код отправлен на номер <b>+7 (9**) ***-35-36</b>
            </div>

            <div className="code-input" style={{ marginBottom: '20px' }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  style={{
                    borderColor: digit ? 'var(--rt-purple)' : '#ddd',
                    fontWeight: 'bold',
                    color: 'var(--rt-purple)',
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
              onClick={handleVerifyOtp}
            >
              Подтвердить вход
            </button>

            <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--rt-muted)' }}>
              {timer > 0 ? (
                <span>Запросить повторный код через {timer} сек.</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setTimer(45)}
                  style={{ color: 'var(--rt-purple)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Отправить код повторно
                </button>
              )}
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Вернуться к логину
              </button>
            </div>
          </div>
        )}

        {onCancel && (
          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ background: 'none', border: 'none', color: '#999', fontSize: '12px', cursor: 'pointer' }}
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
