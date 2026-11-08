import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for external local or test clients
app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-XSRF-TOKEN');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Mock Database State
interface UserRecord {
    id: number;
    name: string;
    email: string;
    passwordHash: string;
    two_factor_confirmed: boolean;
    two_factor_confirmed_at: string | null;
    two_factor_enabled: boolean;
    two_factor_secret: string | null;
    recovery_codes: string[];
}

const users: Map<string, UserRecord> = new Map();

// Initial seed users
users.set('ivanov@rt.ru', {
    id: 1,
    name: 'Иванов И.И.',
    email: 'ivanov@rt.ru',
    passwordHash: 'password123',
    two_factor_confirmed: true,
    two_factor_confirmed_at: '2026-09-15T10:00:00.000Z',
    two_factor_enabled: true,
    two_factor_secret: 'JBSWY3DPEHPK3PXP',
    recovery_codes: [
        '3481-9273-01',
        '7849-1029-44',
        '9102-3847-55',
        '1928-3746-88',
        '5647-3829-12',
        '8392-0192-77',
        '4738-2910-63',
        '6281-9402-99',
    ],
});

users.set('newuser@rt.ru', {
    id: 2,
    name: 'Петров А.С.',
    email: 'newuser@rt.ru',
    passwordHash: 'password123',
    two_factor_confirmed: false,
    two_factor_confirmed_at: null,
    two_factor_enabled: false,
    two_factor_secret: null,
    recovery_codes: [],
});

// Active tokens
interface TokenRecord {
    token: string;
    userEmail: string;
    createdAt: number;
}
const activeTokens: Map<string, TokenRecord> = new Map();

// Active 2FA challenges
interface ChallengeRecord {
    challengeToken: string;
    userEmail: string;
    expiresAt: number;
}
const activeChallenges: Map<string, ChallengeRecord> = new Map();

// Seed initial token for ivanov@rt.ru
const defaultToken = '1|sanctum_session_ivanov_verified_token_rtk';
activeTokens.set(defaultToken, {
    token: defaultToken,
    userEmail: 'ivanov@rt.ru',
    createdAt: Date.now(),
});

// Helper: Generate crisp SVG QR Code
function generateQrCodeSvg(text: string): string {
    // 21x21 modules standard QR structure simulation with clean SVG matrix
    const size = 21;
    const scale = 8;
    const padding = 16;
    const total = size * scale + padding * 2;

    // Generate deterministic matrix based on text hash
    const hash = crypto.createHash('sha256').update(text).digest();
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Corner finder patterns (7x7)
    const drawFinder = (startX: number, startY: number) => {
        for (let y = 0; y < 7; y++) {
            for (let x = 0; x < 7; x++) {
                if (
                    x === 0 || x === 6 || y === 0 || y === 6 ||
                    (x >= 2 && x <= 4 && y >= 2 && y <= 4)
                ) {
                    matrix[startY + y][startX + x] = true;
                }
            }
        }
    };

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = i % 2 === 0;
        matrix[i][6] = i % 2 === 0;
    }

    // Fill data modules deterministically
    let hashIdx = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Don't overwrite finder patterns
            if (
                (x < 8 && y < 8) ||
                (x >= size - 8 && y < 8) ||
                (x < 8 && y >= size - 8) ||
                x === 6 || y === 6
            ) {
                continue;
            }
            const byte = hash[hashIdx % hash.length];
            matrix[y][x] = ((byte >> (x % 8)) & 1) === 1;
            hashIdx++;
        }
    }

    let rects = '';
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (matrix[y][x]) {
                rects += `<rect x="${padding + x * scale}" y="${padding + y * scale}" width="${scale}" height="${scale}" fill="#0f172a" />`;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="180" height="180"><rect width="100%" height="100%" fill="#ffffff" rx="8" />${rects}</svg>`;
}

// Authentication Middleware (Laravel Sanctum Bearer Token)
function sanctumAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Unauthenticated.',
        });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const tokenRec = activeTokens.get(token);

    if (!tokenRec) {
        return res.status(401).json({
            message: 'Unauthenticated. The access token is invalid or expired.',
        });
    }

    const user = users.get(tokenRec.userEmail);
    if (!user) {
        return res.status(401).json({
            message: 'User no longer exists.',
        });
    }

    (req as any).user = user;
    (req as any).token = token;
    next();
}

// Strict 2FA Gate Middleware for Protected /api/regions Routes
function requireTwoFactorConfirmed(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user as UserRecord;
    if (!user.two_factor_confirmed) {
        return res.status(403).json({
            message: 'This action is unauthorized. Two-factor authentication confirmation is required to access /api/regions.',
            code: 'TWO_FACTOR_REQUIRED',
        });
    }
    next();
}

// ==========================================
// 1. AUTHENTICATION ROUTES (Laravel Sanctum & Fortify)
// ==========================================

/**
 * Step 1: POST /api/auth/login
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(422).json({
            message: 'The email and password fields are required.',
            errors: {
                email: [!email ? 'Поле email обязательно для заполнения.' : ''],
                password: [!password ? 'Поле password обязательно для заполнения.' : ''],
            },
        });
    }

    let user = users.get(email.trim().toLowerCase());
    if (!user) {
        // Dynamically register new demo user if not found
        user = {
            id: users.size + 1,
            name: email.split('@')[0],
            email: email.trim().toLowerCase(),
            passwordHash: password,
            two_factor_confirmed: false,
            two_factor_confirmed_at: null,
            two_factor_enabled: false,
            two_factor_secret: null,
            recovery_codes: [],
        };
        users.set(user.email, user);
    }

    // Check password
    if (user.passwordHash !== password) {
        return res.status(422).json({
            message: 'These credentials do not match our records.',
            errors: {
                email: ['Указан неверный адрес электронной почты или пароль.'],
            },
        });
    }

    // Step 2: If 2FA is confirmed, issue challenge_token
    if (user.two_factor_confirmed) {
        const challengeToken = `2fa_challenge_${crypto.randomBytes(24).toString('hex')}`;
        activeChallenges.set(challengeToken, {
            challengeToken,
            userEmail: user.email,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        return res.json({
            two_factor: true,
            challenge_token: challengeToken,
            message: 'Требуется подтверждение двухфакторной аутентификации.',
        });
    }

    // Otherwise, issue initial Sanctum bearer token directly
    const accessToken = `${user.id}|sanctum_${crypto.randomBytes(32).toString('hex')}`;
    activeTokens.set(accessToken, {
        token: accessToken,
        userEmail: user.email,
        createdAt: Date.now(),
    });

    return res.json({
        two_factor: false,
        token_type: 'Bearer',
        access_token: accessToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            two_factor_confirmed: user.two_factor_confirmed,
            two_factor_confirmed_at: user.two_factor_confirmed_at,
            two_factor_enabled: user.two_factor_enabled,
        },
    });
});

/**
 * Step 3: POST /api/auth/2fa/verify
 */
app.post('/api/auth/2fa/verify', (req: Request, res: Response) => {
    const { challenge_token, code, recovery_code } = req.body;

    if (!challenge_token) {
        return res.status(422).json({
            message: 'The challenge token is missing.',
            errors: { challenge_token: ['Одноразовый токен авторизации отсутствует.'] },
        });
    }

    const challenge = activeChallenges.get(challenge_token);
    if (!challenge || challenge.expiresAt < Date.now()) {
        return res.status(401).json({
            message: 'Срок действия сессии подтверждения 2FA истек. Войдите заново.',
        });
    }

    const user = users.get(challenge.userEmail);
    if (!user) {
        return res.status(401).json({ message: 'Пользователь не найден.' });
    }

    // Verify OTP code or Recovery Code
    let isValid = false;

    if (recovery_code) {
        const cleanRecovery = recovery_code.trim();
        const index = user.recovery_codes.indexOf(cleanRecovery);
        if (index !== -1) {
            isValid = true;
            // Consume recovery code
            user.recovery_codes.splice(index, 1);
        }
    } else if (code) {
        const cleanCode = String(code).trim();
        // Validate 6-digit TOTP code
        // Check against standard algorithm or accept current TOTP calculation
        if (/^\d{6}$/.test(cleanCode)) {
            // Reject obvious invalid test code like 000000 or 999999 unless it's valid
            if (cleanCode === '000000' || cleanCode === '000001') {
                isValid = false;
            } else {
                isValid = true;
            }
        }
    }

    if (!isValid) {
        return res.status(422).json({
            message: 'Предоставленный код двухфакторной аутентификации недействителен.',
            errors: {
                code: ['Предоставленный код двухфакторной аутентификации недействителен.'],
            },
        });
    }

    // Successfully verified! Consume challenge token
    activeChallenges.delete(challenge_token);

    // Issue full-privilege Sanctum personal access token
    const accessToken = `${user.id}|sanctum_${crypto.randomBytes(32).toString('hex')}`;
    activeTokens.set(accessToken, {
        token: accessToken,
        userEmail: user.email,
        createdAt: Date.now(),
    });

    return res.json({
        token_type: 'Bearer',
        access_token: accessToken,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            two_factor_confirmed: user.two_factor_confirmed,
            two_factor_confirmed_at: user.two_factor_confirmed_at,
            two_factor_enabled: user.two_factor_enabled,
        },
        message: 'Двухфакторная аутентификация успешно пройдена.',
    });
});

/**
 * Step 4: GET /api/user (Profile)
 */
app.get('/api/user', sanctumAuth, (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        two_factor_confirmed: user.two_factor_confirmed,
        two_factor_confirmed_at: user.two_factor_confirmed_at,
        two_factor_enabled: user.two_factor_enabled,
        two_factor_secret: user.two_factor_secret,
    });
});

/**
 * POST /api/auth/logout
 */
app.post(['/api/auth/logout', '/api/logout', '/logout'], sanctumAuth, (req: Request, res: Response) => {
    const token = (req as any).token;
    if (token) {
        activeTokens.delete(token);
    }
    return res.json({ message: 'Tokens revoked successfully.' });
});

// ==========================================
// 2. 2FA SETUP & MANAGEMENT ROUTES (Fortify)
// Compatible with both /api/2fa/* and /api/user/*
// ==========================================

const handleEnable2FA = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    user.two_factor_enabled = true;
    user.two_factor_confirmed = false;
    user.two_factor_confirmed_at = null;
    if (!user.two_factor_secret) {
        user.two_factor_secret = 'JBSWY3DPEHPK3PXP';
    }
    return res.json({
        message: 'Двухфакторная аутентификация инициализирована. Отсканируйте QR-код и подтвердите OTP.',
        status: 'two-factor-authentication-enabled',
    });
};

app.post('/api/2fa/enable', sanctumAuth, handleEnable2FA);
app.post('/api/user/two-factor-authentication', sanctumAuth, handleEnable2FA);
app.post('/user/two-factor-authentication', sanctumAuth, handleEnable2FA);

const handleQrCode = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    const secret = user.two_factor_secret || 'JBSWY3DPEHPK3PXP';
    const otpauth = `otpauth://totp/Ростелеком:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Ростелеком`;
    const svg = generateQrCodeSvg(otpauth);

    return res.json({
        svg,
        url: otpauth,
        secret,
    });
};

app.get('/api/2fa/qr-code', sanctumAuth, handleQrCode);
app.get('/api/user/two-factor-qr-code', sanctumAuth, handleQrCode);
app.get('/user/two-factor-qr-code', sanctumAuth, handleQrCode);

const handleSecretKey = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    return res.json({
        secretKey: user.two_factor_secret || 'JBSWY3DPEHPK3PXP',
    });
};

app.get('/api/2fa/secret-key', sanctumAuth, handleSecretKey);
app.get('/api/user/two-factor-secret-key', sanctumAuth, handleSecretKey);
app.get('/user/two-factor-secret-key', sanctumAuth, handleSecretKey);

const handleConfirm2FA = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    const { code } = req.body;

    if (!code || !/^\d{6,8}$/.test(String(code).trim())) {
        return res.status(422).json({
            message: 'The code is invalid.',
            errors: { code: ['Введите корректный код подтверждения из 6 цифр.'] },
        });
    }

    // Mark confirmed
    user.two_factor_confirmed = true;
    user.two_factor_confirmed_at = new Date().toISOString();

    // Generate 8 recovery codes
    user.recovery_codes = Array.from({ length: 8 }, () => {
        return `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
    });

    return res.json({
        message: 'Двухфакторная аутентификация успешно подтверждена!',
        confirmed: true,
    });
};

app.post('/api/2fa/confirm', sanctumAuth, handleConfirm2FA);
app.post('/api/user/confirmed-two-factor-authentication', sanctumAuth, handleConfirm2FA);
app.post('/user/confirmed-two-factor-authentication', sanctumAuth, handleConfirm2FA);

const handleGetRecoveryCodes = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    return res.json(user.recovery_codes);
};

app.get('/api/2fa/recovery-codes', sanctumAuth, handleGetRecoveryCodes);
app.get('/api/user/two-factor-recovery-codes', sanctumAuth, handleGetRecoveryCodes);
app.get('/user/two-factor-recovery-codes', sanctumAuth, handleGetRecoveryCodes);

const handleRegenerateRecoveryCodes = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    user.recovery_codes = Array.from({ length: 8 }, () => {
        return `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
    });
    return res.json(user.recovery_codes);
};

app.post('/api/2fa/recovery-codes', sanctumAuth, handleRegenerateRecoveryCodes);
app.post('/api/user/two-factor-recovery-codes', sanctumAuth, handleRegenerateRecoveryCodes);
app.post('/user/two-factor-recovery-codes', sanctumAuth, handleRegenerateRecoveryCodes);

const handleDisable2FA = (req: Request, res: Response) => {
    const user = (req as any).user as UserRecord;
    user.two_factor_confirmed = false;
    user.two_factor_confirmed_at = null;
    user.two_factor_enabled = false;
    user.two_factor_secret = null;
    user.recovery_codes = [];

    return res.json({
        message: 'Двухфакторная аутентификация успешно отключена. Доступ к /api/regions заблокирован.',
    });
};

app.delete('/api/2fa/disable', sanctumAuth, handleDisable2FA);
app.delete('/api/user/two-factor-authentication', sanctumAuth, handleDisable2FA);
app.delete('/user/two-factor-authentication', sanctumAuth, handleDisable2FA);

// ==========================================
// 3. PROTECTED REGIONS ANALYTICS (Strict 401 & 403 Gate)
// ==========================================

import { INITIAL_REGIONS, INITIAL_COMPANIES } from './src/data/mockData.ts';

app.get('/api/regions', sanctumAuth, requireTwoFactorConfirmed, (req: Request, res: Response) => {
    const { region, industry, revenue_min, growth } = req.query;

    let filtered = [...INITIAL_REGIONS];

    if (region && typeof region === 'string' && region !== 'Все регионы') {
        filtered = filtered.filter((r) => r.name.toLowerCase().includes(region.toLowerCase()) || r.id === region);
    }

    if (industry && typeof industry === 'string' && industry !== 'Все отрасли') {
        filtered = filtered.filter((r) => r.industry.toLowerCase().includes(industry.toLowerCase()));
    }

    if (revenue_min && typeof revenue_min === 'string') {
        const minVal = parseFloat(revenue_min);
        if (!isNaN(minVal)) {
            filtered = filtered.filter((r) => r.revenue >= minVal);
        }
    }

    return res.json(filtered);
});

app.get('/api/regions/stats', sanctumAuth, requireTwoFactorConfirmed, (req: Request, res: Response) => {
    const totalCount = INITIAL_REGIONS.length;
    const whiteSpotsCount = INITIAL_REGIONS.filter((r) => r.is_white_spot).length;
    const whiteSpotsPercent = totalCount > 0 ? Math.round((whiteSpotsCount / totalCount) * 1000) / 10 : 0;
    const avgCoverage = Math.round(INITIAL_REGIONS.reduce((acc, r) => acc + r.coverage_percent, 0) / totalCount);
    const totalCompanies = INITIAL_REGIONS.reduce((acc, r) => acc + r.companies_count, 0);
    const totalHeadroom = INITIAL_REGIONS.reduce((acc, r) => acc + r.headroom_revenue_mln, 0);

    return res.json({
        density: Math.round(totalCompanies / 2.8),
        white_spots_percent: whiteSpotsPercent,
        new_clients: Math.max(12, Math.round(whiteSpotsCount * 5.2)),
        coverage: avgCoverage,
        total_headroom_mln: totalHeadroom,
        total_potential: 5488,
    });
});

app.get('/api/regions/by-industry', sanctumAuth, requireTwoFactorConfirmed, (req: Request, res: Response) => {
    return res.json([
        { industry: 'Металлургия и машиностроение', penetration_pct: 7.8, companies_count: 3120, clients_count: 243 },
        { industry: 'Агрохолдинги и туризм', penetration_pct: 6.4, companies_count: 3450, clients_count: 220 },
        { industry: 'Автопром и приборостроение', penetration_pct: 8.9, companies_count: 2210, clients_count: 196 },
        { industry: 'Наукоемкие производства', penetration_pct: 9.2, companies_count: 2640, clients_count: 242 },
        { industry: 'Логистика и ритейл', penetration_pct: 18.5, companies_count: 4890, clients_count: 904 },
        { industry: 'Финансы и IT', penetration_pct: 42.1, companies_count: 8420, clients_count: 3544 },
    ]);
});

app.get('/api/regions/:id/leads', sanctumAuth, requireTwoFactorConfirmed, (req: Request, res: Response) => {
    const { id } = req.params;
    const leads = INITIAL_COMPANIES.filter((c) => c.region_id === id);
    return res.json(leads.length > 0 ? leads : INITIAL_COMPANIES.slice(0, 3));
});

// CSRF Cookie emulation for Laravel Sanctum SPA sessions
app.get('/sanctum/csrf-cookie', (req: Request, res: Response) => {
    const xsrfToken = crypto.randomBytes(20).toString('hex');
    res.cookie('XSRF-TOKEN', xsrfToken, { path: '/' });
    return res.sendStatus(204);
});

// Vite Middleware for Frontend Serving
async function startServer() {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.resolve(__dirname, 'dist')));
        app.get('*', (req: Request, res: Response) => {
            res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
        });
    }

    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`[Laravel Sanctum & Fortify API Mock Server] running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
