<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Fortify\RecoveryCode;

class AuthController extends Controller
{
    /**
     * Первый этап: email и пароль.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = Str::lower(trim($data['email']));

        $limitKey = 'api-login:' . hash(
                'sha256',
                $email . '|' . $request->ip()
            );

        if (RateLimiter::tooManyAttempts($limitKey, 5)) {
            return response()->json([
                'message' => 'Слишком много попыток входа. Попробуйте позже.',
            ], 429);
        }

        $user = User::where('email', $email)->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($limitKey, 60);

            return response()->json([
                'message' => 'Неверная почта или пароль.',
            ], 401);
        }

        RateLimiter::clear($limitKey);

        // Если 2FA ещё не подтверждена — разрешаем только её настройку.
        if (!$user->two_factor_secret || !$user->two_factor_confirmed_at) {
            // Отзываем предыдущие незавершённые setup-токены.
            $user->tokens()
                ->where('name', '2fa-setup')
                ->delete();

            $token = $user->createToken(
                '2fa-setup',
                ['2fa-setup'],
                now()->addMinutes(10)
            );

            return response()->json([
                'message' => 'Необходимо настроить двухфакторную аутентификацию.',
                'two_factor_setup_required' => true,
                'token_type' => 'Bearer',
                'access_token' => $token->plainTextToken,
                'expires_at' => $token->accessToken->expires_at,
            ]);
        }

        // Создаём одноразовый challenge для второго этапа входа.
        $challenge = Str::random(64);

        Cache::put(
            'api-2fa:' . hash('sha256', $challenge),
            ['user_id' => $user->id],
            now()->addMinutes(5)
        );

        return response()->json([
            'message' => 'Введите код из приложения-аутентификатора.',
            'two_factor_required' => true,
            'challenge_token' => $challenge,
            'expires_in' => 300,
        ]);
    }

    /**
     * Второй этап: проверка кода 2FA и выдача основного токена.
     */
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string', 'size:64'],
            'code' => ['required', 'string', 'regex:/^[0-9]{6,8}$/'],
        ]);

        $key = 'api-2fa:' . hash(
                'sha256',
                $data['challenge_token']
            );

        return Cache::lock($key . ':lock', 10)->block(
            3,
            function () use ($key, $data) {
                $challenge = Cache::get($key);

                if (!$challenge) {
                    return response()->json([
                        'message' => 'Challenge истёк или уже использован.',
                    ], 401);
                }

                $attemptKey = $key . ':attempts';

                if (RateLimiter::tooManyAttempts($attemptKey, 5)) {
                    Cache::forget($key);

                    return response()->json([
                        'message' => 'Превышено количество попыток.',
                    ], 429);
                }

                $user = User::find($challenge['user_id']);

                if (
                    !$user ||
                    !$user->two_factor_secret ||
                    !$user->two_factor_confirmed_at
                ) {
                    Cache::forget($key);

                    return response()->json([
                        'message' => 'Аккаунт или 2FA недоступны.',
                    ], 401);
                }

                try {
                    $secret = Crypt::decrypt($user->two_factor_secret);

                    $valid = app(TwoFactorAuthenticationProvider::class)
                        ->verify($secret, $data['code']);
                } catch (\Throwable $e) {
                    report($e);

                    return response()->json([
                        'message' => 'Не удалось проверить код 2FA.',
                    ], 503);
                }

                if (!$valid) {
                    RateLimiter::hit($attemptKey, 300);

                    return response()->json([
                        'message' => 'Неверный код подтверждения.',
                    ], 422);
                }

                // Challenge одноразовый.
                Cache::forget($key);
                RateLimiter::clear($attemptKey);

                $token = $user->createToken(
                    'api-auth',
                    ['two-factor'],
                    now()->addHours(12)
                );

                return response()->json([
                    'message' => 'Авторизация успешна.',
                    'token_type' => 'Bearer',
                    'access_token' => $token->plainTextToken,
                    'expires_at' => $token->accessToken->expires_at,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'two_factor_confirmed' => true,
                    ],
                ]);
            }
        );
    }

    /**
     * Начало настройки 2FA.
     * Доступно только с токеном ability 2fa-setup.
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();
        $token = $user->currentAccessToken();

        if (!$token || !$token->can('2fa-setup')) {
            return response()->json([
                'message' => 'Недостаточно прав для настройки 2FA.',
            ], 403);
        }

        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'message' => 'Двухфакторная аутентификация уже настроена.',
            ], 409);
        }

        $attributes = [];

        if (!$user->two_factor_secret) {
            $secret = app(TwoFactorAuthenticationProvider::class)
                ->generateSecretKey();

            $attributes['two_factor_secret'] = Crypt::encrypt($secret);
        }

        if (!$user->two_factor_recovery_codes) {
            $recoveryCodes = collect(range(1, 8))
                ->map(fn () => RecoveryCode::generate())
                ->all();

            $attributes['two_factor_recovery_codes'] = Crypt::encrypt(
                json_encode($recoveryCodes)
            );
        }

        if (!empty($attributes)) {
            $user->forceFill($attributes)->save();
        }

        return response()->json([
            'message' => 'Секрет и резервные коды подготовлены.',
        ]);
    }

    /**
     * Получение QR-кода и ручного секрета.
     */
    public function setupQr(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->two_factor_secret || $user->two_factor_confirmed_at) {
            return response()->json([
                'message' => 'Сначала начните настройку 2FA.',
            ], 409);
        }

        try {
            return response()->json([
                'svg' => $user->twoFactorQrCodeSvg(),
                'secret' => Crypt::decrypt($user->two_factor_secret),
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Не удалось создать QR-код. Проверьте установку Fortify и QR-библиотеки.',
            ], 503);
        }
    }

    /**
     * Подтверждение настройки кодом из приложения.
     */
    public function confirmSetup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^[0-9]{6,8}$/'],
        ]);

        $user = $request->user();
        $token = $user->currentAccessToken();

        if (!$token || !$token->can('2fa-setup')) {
            return response()->json([
                'message' => 'Недостаточно прав для подтверждения настройки.',
            ], 403);
        }

        if (!$user->two_factor_secret || $user->two_factor_confirmed_at) {
            return response()->json([
                'message' => 'Настройка 2FA уже завершена или не начата.',
            ], 409);
        }

        try {
            $secret = Crypt::decrypt($user->two_factor_secret);

            $valid = app(TwoFactorAuthenticationProvider::class)
                ->verify($secret, $data['code']);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Не удалось проверить код 2FA.',
            ], 503);
        }

        if (!$valid) {
            return response()->json([
                'message' => 'Неверный код подтверждения.',
            ], 422);
        }

        $user->forceFill([
            'two_factor_confirmed_at' => now(),
        ])->save();

        $recoveryCodes = $user->recoveryCodes();

        // Временный токен настройки больше не нужен.
        $token->delete();

        return response()->json([
            'message' => 'Двухфакторная аутентификация успешно настроена.',
            'confirmed' => true,
            'recovery_codes' => $recoveryCodes,
            'login_required' => true,
        ]);
    }

    /**
     * Выход из аккаунта.
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Выход выполнен.',
        ]);
    }
}
