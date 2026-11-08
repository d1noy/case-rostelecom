<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RegionsController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// ========================================
// АВТОРИЗАЦИЯ И НАСТРОЙКА 2FA
// ========================================

Route::prefix('auth')->name('auth.')->group(function () {

    // Первый этап: логин и пароль
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1')
        ->name('login');

    // Первоначальная настройка 2FA.
    // Требуется временный Sanctum-токен с ability 2fa-setup.
    Route::middleware(['auth:sanctum', 'abilities:2fa-setup'])
        ->group(function () {

            Route::post('/2fa/setup', [AuthController::class, 'setup'])
                ->middleware('throttle:5,1')
                ->name('2fa.setup');

            Route::get('/2fa/setup/qr', [AuthController::class, 'setupQr'])
                ->middleware('throttle:10,1')
                ->name('2fa.setup.qr');

            Route::post('/2fa/setup/confirm', [AuthController::class, 'confirmSetup'])
                ->middleware('throttle:5,1')
                ->name('2fa.setup.confirm');
        });

    // Второй этап обычного входа: проверка кода 2FA
    Route::post('/2fa/verify', [AuthController::class, 'verify'])
        ->middleware('throttle:10,1')
        ->name('2fa.verify');

    // Выход из аккаунта
    Route::post('/logout', [AuthController::class, 'logout'])
        ->middleware('auth:sanctum')
        ->name('logout');
});

// ========================================
// ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
// ========================================

Route::middleware('auth:sanctum')
    ->get('/user', [UserController::class, 'me'])
    ->name('user');

// ========================================
// API РЕГИОНОВ
// Требуются авторизация и подтверждённая 2FA
// ========================================

Route::middleware(['auth:sanctum', 'two-factor'])
    ->prefix('regions')
    ->name('regions.')
    ->group(function () {

        // Список регионов
        Route::get('/', [RegionsController::class, 'getRegions'])
            ->name('index');

        // Статистика
        Route::get('/stats', [RegionsController::class, 'getRegionsStats'])
            ->name('stats');

        // Экспорт CSV
        Route::get('/export', [RegionsController::class, 'exportCsv'])
            ->name('export');

        // Данные по отраслям
        Route::get('/by-industry', [RegionsController::class, 'getRegionsByIndustry'])
            ->name('by-industry');

        // Данные для карты
        Route::get('/map-data', function () {
            // Топ-отрасль по выручке неохваченных компаний в каждом регионе
            $topIndustry = DB::table('companies')
                ->where('is_client', false)
                ->whereNotNull('industry')
                ->selectRaw('region_id, industry, SUM(revenue) AS rev')
                ->groupBy('region_id', 'industry')
                ->orderByDesc('rev')
                ->get()
                ->unique('region_id')
                ->pluck('industry', 'region_id');

            return DB::table('regions')
                ->leftJoin('companies', 'regions.id', '=', 'companies.region_id')
                ->select('regions.id', 'regions.name', 'regions.key', 'regions.type', 'regions.lat', 'regions.lon')
                ->selectRaw('COUNT(companies.id) AS companies_count')
                ->selectRaw('COALESCE(SUM(companies.revenue), 0) AS total_revenue')
                ->selectRaw('SUM(CASE WHEN companies.is_client = 1 THEN 1 ELSE 0 END) AS clients')
                ->selectRaw('COALESCE(SUM(CASE WHEN companies.is_client = 0 THEN companies.revenue END), 0) AS headroom')
                ->groupBy('regions.id', 'regions.name', 'regions.key', 'regions.type', 'regions.lat', 'regions.lon')
                ->get()
                ->map(function ($r) use ($topIndustry) {
                    $total     = (int) $r->companies_count;
                    $clients   = (int) $r->clients;
                    $coverage  = $total ? round($clients / $total * 100, 1) : 0;
                    $potential = $total - $clients;
                    $score     = (int) min(100, round((100 - $coverage) * 0.6 + min($potential, 100) * 0.4));

                    return [
                        'id' => $r->id,
                        'name' => $r->name,
                        'key' => $r->key,
                        'type' => $r->type,
                        'lat' => $r->lat,
                        'lon' => $r->lon,
                        'companies_count' => $total,
                        'total_revenue' => (float) $r->total_revenue,
                        'coverage_percent' => $coverage,
                        'potential_count' => $potential,
                        'headroom_revenue_mln' => (int) round($r->headroom / 1e6),
                        'score' => $score,
                        'priority_grade' => $score >= 85 ? 'A+' : ($score >= 70 ? 'A' : 'B'),
                        'is_white_spot' => $coverage < 15 && $potential >= 5,
                        'industry' => $topIndustry[$r->id] ?? '—',
                    ];
                });
        })->name('map-data');
        // Компании и лиды региона
        Route::get('/{regionId}/leads', function (
            Request $request,
            int $regionId
        ) {
            $query = DB::table('companies')
                ->where('region_id', $regionId);

            if ($request->query('status') === 'leads') {
                $query->where('is_client', false);
            }

            if ($request->query('status') === 'clients') {
                $query->where('is_client', true);
            }

            return $query
                ->orderByDesc('employees')
                ->get([
                    'id',
                    'name',
                    'inn',
                    'revenue',
                    'city',
                    'employees',
                    'is_client',
                    'region_id',
                    'lat',
                    'lon',
                    'industry',
                ])
                ->map(fn ($company) => [
                    'id' => $company->id,
                    'region_id' => $company->region_id,
                    'name' => $company->name,
                    'inn' => $company->inn,
                    'industry' => $company->industry,
                    'revenue' => $company->revenue,
                    'address' => $company->city ?? 'Адрес не указан',
                    'phone' => 'Телефон не указан',
                    'lat' => $company->lat,
                    'lon' => $company->lon,
                    'is_client' => (bool) $company->is_client,
                    'score' => ($company->employees ?? 0) >= 10 ? 85 : 40,
                    'priority' => ($company->employees ?? 0) >= 10
                        ? 'high'
                        : 'low',
                ]);
        })
            ->whereNumber('regionId')
            ->name('leads');

        // Регион по ID — в конце
        Route::get('/{id}', [RegionsController::class, 'getRegionById'])
            ->whereNumber('id')
            ->name('show');
    });

// ========================================
// API КОМПАНИЙ И ЛИДОВ
// Требуются авторизация и подтверждённая 2FA
// Используется модалкой «Реестр предприятий»
// ========================================

Route::middleware(['auth:sanctum', 'two-factor'])
    ->prefix('companies')
    ->name('companies.')
    ->group(function () {

        // Общий билдер запроса: region_id, status, q
        $baseQuery = function (Request $request) {
            $query = DB::table('companies');

            if ($request->filled('region_id')) {
                $query->where('region_id', (int) $request->query('region_id'));
            }

            if ($request->query('status') === 'leads') {
                $query->where('is_client', false);
            }

            if ($request->query('status') === 'clients') {
                $query->where('is_client', true);
            }

            if ($request->filled('q')) {
                $search = '%' . $request->query('q') . '%';
                $query->where(function ($w) use ($search) {
                    $w->where('name', 'like', $search)
                        ->orWhere('inn', 'like', $search);
                });
            }

            return $query;
        };

        // Экспорт CSV для CRM (объявлен до возможного /{id})
        Route::get('/export', function (Request $request) use ($baseQuery) {
            $rows = $baseQuery($request)->get([
                'name',
                'inn',
                'industry',
                'city',
                'revenue',
                'employees',
                'is_client',
            ]);

            return response()->streamDownload(function () use ($rows) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // BOM для корректного открытия в Excel
                fputcsv($out, [
                    'Название',
                    'ИНН',
                    'Отрасль',
                    'Город',
                    'Выручка',
                    'Сотрудники',
                    'Клиент',
                ], ';');

                foreach ($rows as $row) {
                    fputcsv($out, (array) $row, ';');
                }

                fclose($out);
            }, 'crm_leads.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        })->name('export');

        // Список компаний
        Route::get('/', function (Request $request) use ($baseQuery) {
            return $baseQuery($request)
                ->orderByDesc('employees')
                ->limit(500)
                ->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'region_id' => $c->region_id,
                    'name' => $c->name,
                    'inn' => $c->inn,
                    'city' => $c->city ?? '—',
                    'industry' => $c->industry ?? '—',
                    'revenue' => (float) ($c->revenue ?? 0),
                    'employees' => (int) ($c->employees ?? 0),
                    'is_client' => (bool) $c->is_client,
                    // Поля, которых нет в БД: безопасные значения,
                    // иначе фронт падает на .toLowerCase()
                    'fns_risk_level' => 'Низкий',
                    'procurement_type' => '—',
                    'msp_registry' => '—',
                    'recommended_service' => 'ВОЛС / IaaS',
                    'potential_deal_rub' => (int) round(($c->revenue ?? 0) * 0.002),
                ]);
        })->name('index');
    });
