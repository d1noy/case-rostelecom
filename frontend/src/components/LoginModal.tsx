import React, { useState } from 'react';
import {
    Lock,
    Mail,
    KeyRound,
    ShieldCheck,
    AlertTriangle,
    RefreshCw,
    ArrowRight,
    CheckCircle2,
} from 'lucide-react';
import {
    loginWithCredentials,
    verifyTwoFactorLogin,
    fetchCurrentUser,
    UserProfile,
} from '../api/auth';
import { ApiError, removeAccessToken } from '../api/client';
import { TwoFactorSetupScreen } from './TwoFactorSetupScreen';

interface LoginModalProps {
    isOpen: boolean;
    onSuccess: (user: UserProfile) => void;
    onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
                                                          isOpen,
                                                          onSuccess,
                                                          onClose,
                                                      }) => {
    // 'credentials' -> логин/пароль, '2fa_challenge' -> ввод кода, '2fa_setup' -> первая настройка 2FA
    const [authStep, setAuthStep] = useState<'credentials' | '2fa_challenge' | '2fa_setup'>('credentials');

    // Credentials
    const [email, setEmail] = useState('admin@example.com');
    const [password, setPassword] = useState('');

    // 2FA Challenge state
    const [challengeToken, setChallengeToken] = useState<string>('');
    const [otpCode, setOtpCode] = useState<string>('');
    const [useRecoveryCode, setUseRecoveryCode] = useState<boolean>(false);

    // Status & Error
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    // Экран первой настройки 2FA (использует временный токен 2fa-setup)
    if (authStep === '2fa_setup') {
        return (
            <TwoFactorSetupScreen
                isModal
                currentUserEmail={email}
                onSuccess={() => {
                    // После confirm временный токен удалён на сервере
                    removeAccessToken();
                    setAuthStep('credentials');
                    setPassword('');
                    setOtpCode('');
                    setErrorMessage(null);
                    setErrorStatus(null);
                    setInfoMessage('2FA настроена. Войдите снова и введите код из приложения.');
                }}
                onClose={() => {
                    removeAccessToken();
                    setAuthStep('credentials');
                }}
            />
        );
    }

    // Step 1: Submit Credentials
    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            setErrorMessage('Введите рабочий адрес электронной почты и пароль.');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setErrorStatus(null);
        setInfoMessage(null);

        try {
            const response = await loginWithCredentials(email, password);
            const needs2fa = response.two_factor_required || response.two_factor;

            if (needs2fa && response.challenge_token) {
                // Обычный вход: нужен код из приложения
                setChallengeToken(response.challenge_token);
                setAuthStep('2fa_challenge');
                setOtpCode('');
            } else if (response.two_factor_setup_required && response.access_token) {
                // Первая настройка 2FA: временный токен уже сохранён в loginWithCredentials
                setAuthStep('2fa_setup');
            } else if (response.access_token) {
                // Вход без 2FA
                const user = response.user || (await fetchCurrentUser());
                onSuccess(user);
            } else {
                throw new ApiError('Сервер не вернул токен или запрос подтверждения 2FA', 500);
            }
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка авторизации', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Verify 2FA OTP Code
    const handleVerify2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanCode = otpCode.trim();
        if (!cleanCode) {
            setErrorMessage(useRecoveryCode ? 'Введите резервный код.' : 'Введите 6-значный одноразовый OTP код.');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setErrorStatus(null);

        try {
            // verify 2fa challenge, store access_token and fetch profile
            const verifyRes = await verifyTwoFactorLogin(challengeToken, cleanCode, useRecoveryCode);
            const user = verifyRes.user || (await fetchCurrentUser());

            // Открываем приложение только после подтверждённой 2FA
            onSuccess(user);
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Неверный код 2FA', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetToCredentials = () => {
        setAuthStep('credentials');
        setChallengeToken('');
        setOtpCode('');
        setErrorMessage(null);
        setErrorStatus(null);
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                zIndex: 4000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                backdropFilter: 'blur(8px)',
            }}
        >
            <div
                style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
                    border: '1px solid #e2e8f0',
                    width: '100%',
                    maxWidth: '460px',
                    padding: '32px',
                }}
            >
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div
                        style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, var(--rt-purple) 0%, #9333ea 100%)',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(119, 0, 255, 0.35)',
                            marginBottom: '12px',
                        }}
                    >
                        {authStep === 'credentials' ? <Lock size={26} /> : <ShieldCheck size={28} />}
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px', color: 'var(--rt-dark)' }}>
                        {authStep === 'credentials' ? 'Вход в Радар присутствия' : 'Двухфакторная проверка (2FA)'}
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: 0 }}>
                        {authStep === 'credentials'
                            ? 'Авторизация через Laravel Sanctum'
                            : 'Введите код из приложения аутентификации'}
                    </p>
                </div>

                {/* Info notification */}
                {infoMessage && (
                    <div
                        style={{
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '20px',
                            color: '#065f46',
                            fontSize: '13px',
                        }}
                    >
                        {infoMessage}
                    </div>
                )}

                {/* Error notification */}
                {errorMessage && (
                    <div
                        style={{
                            background: '#fff1f2',
                            border: '1px solid #fda4af',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            color: '#be123c',
                            fontSize: '13px',
                        }}
                    >
                        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                            {errorStatus && (
                                <span
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        background: '#e11d48',
                                        color: '#fff',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        marginRight: '6px',
                                    }}
                                >
                                    HTTP {errorStatus}
                                </span>
                            )}
                            <span>{errorMessage}</span>
                        </div>
                    </div>
                )}

                {/* STEP 1: CREDENTIALS FORM */}
                {authStep === 'credentials' ? (
                    <form onSubmit={handleCredentialsSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Рабочий email (Laravel Sanctum)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail
                                    size={18}
                                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                                />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px 10px 38px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '22px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                                Пароль
                            </label>
                            <div style={{ position: 'relative' }}>
                                <KeyRound
                                    size={18}
                                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                                />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px 10px 38px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '12px 18px',
                                fontSize: '14.5px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Проверка учетных данных...</span>
                                </>
                            ) : (
                                <>
                                    <span>Войти</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    /* STEP 2 & 3: 2FA CHALLENGE VERIFY FORM */
                    <form onSubmit={handleVerify2FASubmit}>
                        <div
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '14px',
                                marginBottom: '18px',
                                fontSize: '13px',
                                color: '#475569',
                            }}
                        >
                            Сервер получил запрос на вход для <b>{email}</b> и требует подтверждения
                            двухфакторной аутентификации.
                        </div>

                        <div style={{ marginBottom: '18px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                {useRecoveryCode
                                    ? 'Резервный код восстановления (Recovery Code):'
                                    : 'Одноразовый 6-значный OTP код:'}
                            </label>
                            <input
                                type="text"
                                autoFocus
                                maxLength={useRecoveryCode ? 24 : 8}
                                value={otpCode}
                                onChange={(e) =>
                                    setOtpCode(useRecoveryCode ? e.target.value : e.target.value.replace(/\D/g, ''))
                                }
                                placeholder={useRecoveryCode ? 'abcd-efgh-ijkl' : '123456'}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: useRecoveryCode ? '15px' : '22px',
                                    fontWeight: 700,
                                    letterSpacing: useRecoveryCode ? '1px' : '5px',
                                    textAlign: 'center',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    fontFamily: 'monospace',
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading || !otpCode.trim()}
                            style={{
                                width: '100%',
                                padding: '12px 18px',
                                fontSize: '14.5px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Верификация кода...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={17} />
                                    <span>Подтвердить вход</span>
                                </>
                            )}
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setUseRecoveryCode(!useRecoveryCode);
                                    setOtpCode('');
                                    setErrorMessage(null);
                                }}
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
                                {useRecoveryCode ? 'Использовать код из приложения' : 'Ввести резервный код'}
                            </button>

                            <button
                                type="button"
                                onClick={handleResetToCredentials}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                ← Назад к логину
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
