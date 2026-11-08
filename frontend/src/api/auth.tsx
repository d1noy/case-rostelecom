/**
 * Authentication Service (Laravel Sanctum & Fortify)
 *
 * Implements the exact 5-step authorization flow:
 * Step 1: POST /auth/login with { email, password }
 * Step 2: If 2FA required, backend returns { two_factor: true, challenge_token: string }
 * Step 3: Prompt user for OTP / recovery code -> POST /auth/2fa/verify with { challenge_token, code }
 * Step 4: Receive { access_token, user } -> Store access_token in localStorage, fetch /user
 * Step 5: Grant access to application
 */

import {
    apiJson,
    setAccessToken,
    removeAccessToken,
    getAccessToken,
} from './client';

export interface UserProfile {
    id: number;
    name: string;
    email: string;
    role?: string;
    two_factor_confirmed: boolean;
    two_factor_confirmed_at?: string | null;
    two_factor_enabled?: boolean;
    two_factor_secret?: string | null;
    created_at?: string;
}

export interface LoginResponse {
    user: UserProfile;
    two_factor_setup_required?: boolean;
    two_factor_required?: boolean;
    two_factor?: boolean;
    challenge_token?: string;
    access_token?: string;
    token_type?: string;
    expires_at?: string;
    expires_in?: number;
    message?: string;
}

export interface TwoFactorVerifyResponse {
    access_token: string;
    token_type: string;
    user: UserProfile;
    message?: string;
    expires_at?: string;
}

/**
 * Step 1: Login with email and password.
 */
export async function loginWithCredentials(
    email: string,
    password: string
): Promise<LoginResponse> {
    removeAccessToken();

    const data = await apiJson<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
        }),
    });

    // При первоначальной настройке 2FA сервер выдаёт временный токен.
    // Он нужен для setup/QR/confirm, поэтому его сохраняем.
    if (data.two_factor_setup_required && data.access_token) {
        setAccessToken(data.access_token);
    }

    return data;
}

/**
 * Step 2: Verify 2FA OTP or recovery code.
 */
export async function verifyTwoFactorLogin(
    challengeToken: string,
    code: string,
    isRecoveryCode: boolean = false
): Promise<TwoFactorVerifyResponse> {
    const payload = isRecoveryCode
        ? {
            challenge_token: challengeToken,
            recovery_code: code.trim(),
        }
        : {
            challenge_token: challengeToken,
            code: code.trim(),
        };

    const data = await apiJson<TwoFactorVerifyResponse>(
        '/auth/2fa/verify',
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );

    if (data.access_token) {
        setAccessToken(data.access_token);
    }

    return data;
}

/**
 * Fetch authenticated user profile.
 */
export async function fetchCurrentUser(): Promise<UserProfile> {
    return apiJson<UserProfile>('/user', {
        method: 'GET',
    });
}

/**
 * Logout and clear client token.
 */
export async function logout(): Promise<void> {
    try {
        if (getAccessToken()) {
            await apiJson('/auth/logout', {
                method: 'POST',
            });
        }
    } catch (err) {
        console.warn(
            'Logout API call failed or token already invalidated:',
            err
        );
    } finally {
        removeAccessToken();
    }
}
