/**
 * 2FA API Client под роуты Laravel:
 * POST /auth/2fa/setup, GET /auth/2fa/setup/qr, POST /auth/2fa/setup/confirm
 */
import { apiJson, ApiError } from './client';
import { UserProfile } from './auth';

export interface QrCodeResponse {
    svg: string;
    url?: string;
    secret?: string;
}

export interface SecretKeyResponse {
    secretKey: string;
}

export interface TwoFactorStatus {
    enabled: boolean;
    confirmed: boolean;
    confirmedAt?: string | null;
    user?: UserProfile;
}

let cachedSecret = '';
let cachedCodes: string[] = [];

// Экран настройки открывается с временным токеном 2fa-setup,
// значит 2FA ещё не подтверждена. Отдельного роута статуса нет.
export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
    return { enabled: false, confirmed: false, confirmedAt: null };
}

export async function enableTwoFactor(): Promise<{ message: string }> {
    const r = await apiJson<any>('/auth/2fa/setup', { method: 'POST' });
    cachedSecret = r?.secret ?? r?.secret_key ?? r?.secretKey ?? cachedSecret;
    return r;
}

export async function getTwoFactorQrCode(): Promise<QrCodeResponse> {
    const r = await apiJson<any>('/auth/2fa/setup/qr', { method: 'GET' });
    const secret = r?.secret ?? r?.secret_key ?? r?.secretKey ?? cachedSecret;
    if (secret) cachedSecret = secret;
    return {
        svg: r?.svg ?? r?.qr_code ?? r?.qrCode ?? '',
        url: r?.url ?? r?.otpauth_url,
        secret,
    };
}

export async function getTwoFactorSecretKey(): Promise<SecretKeyResponse> {
    return { secretKey: cachedSecret };
}

export async function confirmTwoFactorOtp(
    code: string
): Promise<{ message: string; confirmed: boolean }> {
    const r = await apiJson<any>('/auth/2fa/setup/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
    });
    cachedCodes = Array.isArray(r?.recovery_codes) ? r.recovery_codes : [];
    return { message: r?.message ?? '', confirmed: Boolean(r?.confirmed) };
}

export async function getRecoveryCodes(): Promise<string[]> {
    return cachedCodes;
}

export async function regenerateRecoveryCodes(): Promise<string[]> {
    throw new ApiError('Обновление кодов пока не поддерживается сервером.', 404);
}

export async function disableTwoFactor(): Promise<{ message: string }> {
    throw new ApiError('Отключение 2FA пока не поддерживается сервером.', 404);
}
