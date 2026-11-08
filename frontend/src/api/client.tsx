
/**
 * Unified Laravel Sanctum API Client
 * - Single source of truth for access_token
 * - Centralized API requests
 * - Laravel JSON error handling
 * - Configurable API base URL
 */

export const ACCESS_TOKEN_KEY = 'access_token';
export const API_BASE_URL_KEY = 'api_base_url';

export class ApiError extends Error {
    status: number;
    data: any;
    errors?: Record<string, string[]>;
    code?: string;

    constructor(message: string, status: number, data: any = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        this.code = data?.code;

        if (data?.errors) {
            this.errors = data.errors;
        }
    }

    get isUnauthorized(): boolean {
        return this.status === 401;
    }

    get isForbidden(): boolean {
        return this.status === 403;
    }

    get isCsrf(): boolean {
        return this.status === 419;
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }

    get isValidationError(): boolean {
        return this.status === 422;
    }

    get friendlyMessage(): string {
        if (this.errors && Object.keys(this.errors).length > 0) {
            const firstKey = Object.keys(this.errors)[0];
            const firstError = this.errors[firstKey]?.[0];

            if (firstError) {
                return `${firstKey}: ${firstError}`;
            }
        }

        if (this.message) {
            return this.message;
        }

        if (this.isUnauthorized) {
            return 'Неверный логин или пароль либо сессия недействительна.';
        }

        if (this.isForbidden) {
            return 'Доступ запрещён. Проверьте права доступа и подтверждение 2FA.';
        }

        if (this.isCsrf) {
            return 'Ошибка CSRF-токена (HTTP 419). Повторите запрос.';
        }

        if (this.isNotFound) {
            return 'Маршрут API не найден (HTTP 404). Проверьте адрес запроса.';
        }

        return `Ошибка сервера: HTTP ${this.status}`;
    }
}

/**
 * Laravel API URL.
 * Can be overridden in localStorage using setApiBaseUrl().
 */
export function getApiBaseUrl(): string {
    if (typeof window !== 'undefined') {
        const custom = localStorage.getItem(API_BASE_URL_KEY);

        if (custom?.trim()) {
            return custom.trim().replace(/\/+$/, '');
        }
    }

    const envUrl =
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_API_URL;

    if (typeof envUrl === 'string' && envUrl.trim()) {
        return envUrl.trim().replace(/\/+$/, '');
    }

    return '/api';
}

export function setApiBaseUrl(url: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    const normalizedUrl = url.trim().replace(/\/+$/, '');

    if (
        !normalizedUrl ||
        normalizedUrl === '/api'
    ) {
        localStorage.removeItem(API_BASE_URL_KEY);
    } else {
        localStorage.setItem(API_BASE_URL_KEY, normalizedUrl);
    }

    window.dispatchEvent(
        new CustomEvent('sanctum:api_base_changed', {
            detail: { url: getApiBaseUrl() },
        })
    );
}

/**
 * Access token management.
 */
export function getAccessToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, token);

    window.dispatchEvent(
        new CustomEvent('sanctum:token_changed', {
            detail: { token },
        })
    );
}

export function removeAccessToken(): void {
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);

    window.dispatchEvent(
        new CustomEvent('sanctum:token_changed', {
            detail: { token: null },
        })
    );
}

/**
 * Extract readable error from non-JSON server responses.
 */
function extractServerErrorMessage(
    responseText: string,
    status: number
): string {
    const text = responseText.trim();

    if (!text) {
        return `Сервер вернул пустой ответ (HTTP ${status}).`;
    }

    if (
        text.startsWith('<?php') ||
        text.includes('namespace App\\')
    ) {
        return (
            `Сервер вернул исходный PHP-код вместо JSON ` +
            `(HTTP ${status}). Проверьте конфигурацию веб-сервера.`
        );
    }

    const phpMatch = text.match(
        /(?:Fatal error|Parse error|Warning|Notice|Uncaught Exception|ErrorException):\s*([^<\n\r]+)/i
    );

    if (phpMatch) {
        return `Ошибка PHP: ${phpMatch[1].trim()}`;
    }

    const titleMatch = text.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    const headingMatch = text.match(
        /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

    const headerText = titleMatch?.[1] || headingMatch?.[1];

    if (headerText) {
        const clean = headerText
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .trim();

        return `Сервер вернул HTML вместо JSON (HTTP ${status}): ${clean}`;
    }

    const plainText = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return (
        `Сервер вернул ответ не в формате JSON ` +
        `(HTTP ${status}): ${plainText.slice(0, 180)}`
    );
}

/**
 * Centralized fetch function.
 */
export async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = getAccessToken();
    const headers = new Headers(options.headers);

    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');

    const isFormData =
        typeof FormData !== 'undefined' &&
        options.body instanceof FormData;

    if (options.body && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    } else {
        headers.delete('Authorization');
    }

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${baseUrl}${normalizedPath}`;

    let response: Response;

    try {
        response = await fetch(fullUrl, {
            ...options,
            headers,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Не удалось подключиться к серверу.';

        throw new ApiError(
            `Ошибка сети при запросе ${normalizedPath}: ${message}. Проверьте, запущен ли Laravel и настроен ли CORS.`,
            0,
            { cause: message, url: fullUrl }
        );
    }

    // Do not clear tokens automatically on login/2FA errors.
    // Login errors should be displayed by the authentication form.
    const isAuthRoute = normalizedPath.startsWith('/auth/');

    if (response.status === 401 && !isAuthRoute) {
        removeAccessToken();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('sanctum:unauthorized', {
                    detail: { path: normalizedPath },
                })
            );
        }
    }

    return response;
}

/**
 * Parse JSON and convert API errors into ApiError.
 */
export async function parseResponse<T = any>(
    response: Response
): Promise<T> {
    const responseText = await response.text();

    let json: any;

    try {
        json = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new ApiError(
            extractServerErrorMessage(responseText, response.status),
            response.status,
            { raw: responseText }
        );
    }

    if (!response.ok) {
        const firstErrorKey = Object.keys(json.errors || {})[0];
        const message =
            json.message ||
            json.error ||
            json.errors?.[firstErrorKey]?.[0] ||
            `Ошибка API: HTTP ${response.status}`;

        throw new ApiError(message, response.status, json);
    }

    return json as T;
}

/**
 * Typed API request: apiFetch + parseResponse.
 */
export async function apiJson<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await apiFetch(path, options);
    return parseResponse<T>(response);
}
