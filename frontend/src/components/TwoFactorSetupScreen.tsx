import React, { useState, useEffect, useCallback } from 'react';
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
    Trash2,
    AlertCircle,
    Key,
} from 'lucide-react';
import {
    getTwoFactorStatus,
    enableTwoFactor,
    getTwoFactorQrCode,
    getTwoFactorSecretKey,
    confirmTwoFactorOtp,
    getRecoveryCodes,
    regenerateRecoveryCodes,
    disableTwoFactor,
} from '../api/twoFactor';
import { ApiError, getAccessToken } from '../api/client';

interface TwoFactorSetupScreenProps {
    onSuccess: () => void;
    currentUserEmail?: string;
    isModal?: boolean;
    onClose?: () => void;
    onStatusChange?: (confirmed: boolean) => void;
}

export const TwoFactorSetupScreen: React.FC<TwoFactorSetupScreenProps> = ({
                                                                              onSuccess,
                                                                              currentUserEmail = 'user@example.com',
                                                                              isModal = false,
                                                                              onClose,
                                                                              onStatusChange,
                                                                          }) => {
    // Step state: 'initial' | 'qr_confirm' | 'confirmed'
    const [step, setStep] = useState<'initial' | 'qr_confirm' | 'confirmed'>('initial');
    const [qrSvg, setQrSvg] = useState<string>('');
    const [secretKey, setSecretKey] = useState<string>('');
    const [otpCode, setOtpCode] = useState<string>('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorStatus, setErrorStatus] = useState<number | null>(null);
    const [copiedKey, setCopiedKey] = useState<boolean>(false);
    const [copiedCodes, setCopiedCodes] = useState<boolean>(false);

    // 1. Check initial user 2FA status using centralized API client
    const checkStatus = useCallback(async () => {
        const token = getAccessToken();
        if (!token) {
            setErrorMessage('Сначала войдите в систему. Требуется Bearer-токен Sanctum.');
            setErrorStatus(401);
            setStep('initial');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setErrorStatus(null);

        try {
            const status = await getTwoFactorStatus();
            if (status.confirmed) {
                setStep('confirmed');
                onStatusChange?.(true);
                // Load recovery codes
                await loadCodes();
            } else if (status.enabled) {
                setStep('qr_confirm');
                onStatusChange?.(false);
                await loadQrAndSecret();
            } else {
                setStep('initial');
                onStatusChange?.(false);
            }
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка проверки статуса', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
        } finally {
            setIsLoading(false);
        }
    }, [onStatusChange]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    // 2. Load QR Code & Secret Key
    const loadQrAndSecret = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [qrData, keyData] = await Promise.all([
                getTwoFactorQrCode(),
                getTwoFactorSecretKey(),
            ]);
            setQrSvg(qrData.svg || '');
            setSecretKey(keyData.secretKey || qrData.secret || '');
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка загрузки данных QR/ключа', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Load Recovery Codes
    const loadCodes = async () => {
        try {
            const codes = await getRecoveryCodes();
            setRecoveryCodes(codes);
        } catch (err: any) {
            console.warn('Не удалось загрузить резервные коды:', err);
        }
    };

    // 4. Enable 2FA action (POST /api/2fa/enable)
    const handleEnableTwoFactor = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setErrorStatus(null);

        try {
            await enableTwoFactor();
            setStep('qr_confirm');
            await loadQrAndSecret();
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка включения 2FA', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
        } finally {
            setIsLoading(false);
        }
    };

    // 5. Confirm OTP Code with backend validation (POST /api/2fa/confirm)
    // FIXED: No fixed 123456 bypass, strictly verifies with server response!
    const handleConfirmOtp = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const cleanCode = otpCode.trim();

        if (!/^\d{6,8}$/.test(cleanCode)) {
            setErrorMessage('Введите корректный одноразовый код из 6–8 цифр из мобильного аутентификатора.');
            setErrorStatus(422);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setErrorStatus(null);

        try {
            const result = await confirmTwoFactorOtp(cleanCode);
            if (result.confirmed) {
                setStep('confirmed');
                setOtpCode('');
                onStatusChange?.(true);
                await loadCodes();
            } else {
                throw new ApiError('Сервер не подтвердил активацию 2FA.', 400);
            }
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка подтверждения OTP кода', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
        } finally {
            setIsLoading(false);
        }
    };

    // 6. Regenerate recovery codes
    const handleRegenerateCodes = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const newCodes = await regenerateRecoveryCodes();
            setRecoveryCodes(newCodes);
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка обновления кодов', 500);
            setErrorMessage(apiErr.friendlyMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // 7. Disable 2FA
    const handleDisableTwoFactor = async () => {
        if (
            !window.confirm(
                'Вы действительно хотите отключить 2FA? Доступ к защищённым аналитическим маршрутам /api/regions будет немедленно заблокирован (HTTP 403 Forbidden).'
            )
        ) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            await disableTwoFactor();
            setStep('initial');
            setOtpCode('');
            setSecretKey('');
            setQrSvg('');
            setRecoveryCodes([]);
            onStatusChange?.(false);
        } catch (err: any) {
            const apiErr = err instanceof ApiError ? err : new ApiError(err?.message || 'Ошибка отключения 2FA', 500);
            setErrorMessage(apiErr.friendlyMessage);
            setErrorStatus(apiErr.status);
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
        const text = `РЕЗЕРВНЫЕ КОДЫ ДВУХФАКТОРНОЙ АУТЕНТИФИКАЦИИ\nПАО «Ростелеком» • Аккаунт: ${currentUserEmail}\nДата генерации: ${new Date().toLocaleString('ru-RU')}\n\n${recoveryCodes.join('\n')}\n\nХраните эти коды в безопасном месте. Каждый резервный код может быть использован ровно один раз.`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rostelecom_2fa_recovery_codes_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div
            style={
                isModal
                    ? {
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.7)',
                        zIndex: 3500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        backdropFilter: 'blur(6px)',
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
                    borderRadius: '14px',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                            style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '12px',
                                background: step === 'confirmed' ? '#ecfdf5' : '#fff7ed',
                                border: `1.5px solid ${step === 'confirmed' ? '#a7f3d0' : '#fed7aa'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: step === 'confirmed' ? '#059669' : 'var(--rt-orange)',
                            }}
                        >
                            {step === 'confirmed' ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--rt-dark)' }}>
                                {step === 'confirmed' ? 'Двухфакторная аутентификация активна' : 'Настройка двухфакторной аутентификации (2FA)'}
                            </h2>
                            <p style={{ fontSize: '13px', color: 'var(--rt-muted)', margin: '3px 0 0' }}>
                                Laravel Sanctum & Fortify API • ПАО «Ростелеком» • Аккаунт: <b>{currentUserEmail}</b>
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
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                lineHeight: 1,
                            }}
                            title="Закрыть"
                        >
                            &times;
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
                                В соответствии с политикой информационной безопасности, данные Модуля 1 («Радар присутствия»)
                                доступны только авторизованным пользователям с подтвержденной двухфакторной аутентификацией.
                            </div>
                        </div>
                    </div>
                )}

                {/* Error message alert with status badge */}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                {errorStatus && (
                                    <span
                                        style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            background: '#e11d48',
                                            color: '#fff',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                        }}
                                    >
                    HTTP {errorStatus}
                  </span>
                                )}
                                <span style={{ fontWeight: 600 }}>Ошибка бэкенда:</span>
                            </div>
                            <div>{errorMessage}</div>
                        </div>
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
                                Порядок подключения:
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Smartphone size={20} color="var(--rt-purple)" style={{ flexShrink: 0 }} />
                                    <div style={{ fontSize: '12.5px', color: '#475569' }}>
                                        <b>1. Приложение аутентификации:</b> Яндекс Ключ, Google Authenticator или 1Password.
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <QrCode size={20} color="var(--rt-orange)" style={{ flexShrink: 0 }} />
                                    <div style={{ fontSize: '12.5px', color: '#475569' }}>
                                        <b>2. Сканирование QR-кода:</b> Отсканируйте камерой или введите секретный ключ вручную.
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
                                    <div style={{ fontSize: '12.5px', color: '#475569' }}>
                                        <b>3. Подтверждение и доступ:</b> Введите 6-значный OTP код для разблокировки защищенных API.
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
                                padding: '13px 20px',
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
                                    <span>Инициализация 2FA через API...</span>
                                </>
                            ) : (
                                <>
                                    <KeyRound size={18} />
                                    <span>Включить двухфакторную аутентификацию (POST /api/2fa/enable)</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* STEP 2: QR & OTP CONFIRMATION */}
                {step === 'qr_confirm' && (
                    <div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: qrSvg ? '260px 1fr' : '1fr',
                                gap: '24px',
                                alignItems: 'center',
                                marginBottom: '24px',
                            }}
                        >
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
                                        Отсканируйте в Google Authenticator или Яндекс Ключ
                                    </div>
                                </div>
                            )}

                            {/* Instructions & Secret Key */}
                            <div>
                                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rt-dark)', margin: '0 0 8px' }}>
                                    Шаг 1. Отсканируйте QR-код или введите секретный ключ
                                </h4>
                                <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 14px' }}>
                                    Откройте приложение аутентификации на смартфоне и наведите камеру на QR-код.
                                    Если камера недоступна, введите секретный ключ вручную:
                                </p>

                                {/* Secret Key Display */}
                                {secretKey && (
                                    <div style={{ marginBottom: '18px' }}>
                                        <label
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                color: 'var(--rt-muted)',
                                                display: 'block',
                                                marginBottom: '4px',
                                            }}
                                        >
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
                                    <label
                                        style={{
                                            fontSize: '13px',
                                            fontWeight: 700,
                                            color: '#1e293b',
                                            display: 'block',
                                            marginBottom: '6px',
                                        }}
                                    >
                                        Шаг 2. Введите 6-значный код из приложения аутентификации:
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <input
                                            type="text"
                                            maxLength={8}
                                            placeholder="6 цифр кода"
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
                                                    <span>Проверка на сервере...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={16} />
                                                    <span>Подтвердить код (POST /api/2fa/confirm)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={handleDisableTwoFactor}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#94a3b8',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                padding: 0,
                                            }}
                                        >
                                            Отменить настройку
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
                                    Двухфакторная аутентификация подтверждена на сервере!
                                </div>
                                <div style={{ fontSize: '13px', color: '#047857', marginTop: '2px' }}>
                                    Эндпоинты <b>/api/regions</b> разблокированы. Запросы передаются с валидным Bearer-токеном Sanctum.
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
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                }}
                            >
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
                                        <span>Обновить (POST)</span>
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
                                                padding: '5px 8px',
                                                borderRadius: '4px',
                                                textAlign: 'center',
                                                letterSpacing: '1px',
                                                border: '1px solid #e2e8f0',
                                            }}
                                        >
                                            {code}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', gridColumn: '1 / -1' }}>
                                        Загрузка кодов восстановления с сервера...
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
