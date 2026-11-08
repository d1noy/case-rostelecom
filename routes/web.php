<?php

use App\Http\Controllers\Panel\DashboardController;
use Illuminate\Support\Facades\Route;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

// ТОЛЬКО ДЛЯ ДЕМО: вход под готовым пользователем
Route::get('/demo-login', function (Request $request) {
    abort_unless(app()->environment('local'), 404);

    $user = User::where('email', 'test@example.com')->firstOrFail();
    Auth::guard('web')->login($user);
    $request->session()->regenerate();

    return response()->json([
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'two_factor_confirmed' => !is_null($user->two_factor_confirmed_at),
    ]);


});

Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard.index');
Route::post('/logout', function () {
    auth()->logout();
    session()->invalidate();
    return redirect('/login');
})->name('logout');
// Критически важный роут для Vite + Sanctum сессий
Route::get('/sanctum/csrf-cookie', function (Request $request) {
    // Возвращаем JSON, чтобы фронтенд мог прочитать ответ
    return response()->json([
        'csrf_token' => $request->session()->token(),
        'session_id' => $request->session()->getId(),
    ]);
})->withoutMiddleware(['verify_csrf_token']);
