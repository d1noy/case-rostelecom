<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class RequireTwoFactorAuthentication
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        if (
            !$user ||
            !$token instanceof PersonalAccessToken ||
            !$token->can('two-factor')
        ) {
            return response()->json([
                'message' => 'Требуется авторизация с подтверждённой 2FA.',
                'two_factor_required' => true,
                'error' => '2FA_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
