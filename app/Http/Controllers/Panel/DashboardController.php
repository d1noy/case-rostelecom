<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\Panel\Region;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class DashboardController extends Controller
{
    public function index()
    {
        // Если модели вообще нет (редкий кейс) — демо-коллекция
        if (!class_exists(Region::class)) {
            $regions = collect([
                ['name' => 'Центр Москвы', 'revenue' => 1500000, 'latitude' => 55.7558, 'longitude' => 37.6176, 'is_white_spot' => false],
                ['name' => 'Химки', 'revenue' => 800000,  'latitude' => 55.8978, 'longitude' => 37.4280, 'is_white_spot' => true],
                ['name' => 'Мытищи', 'revenue' => 500000,  'latitude' => 55.9116, 'longitude' => 37.7308, 'is_white_spot' => false],
            ]);
            $totalCount = $regions->count();
            $whiteSpotsPercent = 33.3;
        } else {
            // Реальная логика: берём все регионы
            $regions = Region::all();

            // Если таблица пустая — создаём 3 тестовых региона (один из них — белое пятно)
            if ($regions->isEmpty()) {
                Region::create([
                    'name' => 'Центр Москвы',
                    'latitude' => 55.7558,
                    'longitude' => 37.6176,
                    'revenue' => 1500000,
                    'is_white_spot' => false,
                ]);
                Region::create([
                    'name' => 'Химки',
                    'latitude' => 55.8978,
                    'longitude' => 37.4280,
                    'revenue' => 800000,
                    'is_white_spot' => true, // Белое пятно
                ]);
                Region::create([
                    'name' => 'Мытищи',
                    'latitude' => 55.9116,
                    'longitude' => 37.7308,
                    'revenue' => 500000,
                    'is_white_spot' => false,
                ]);

                $regions = Region::all(); // Перечитываем
            }

            $totalCount = $regions->count();
            // Считаем количество белых пятен
            $whiteSpotsCount = $regions->where('is_white_spot', true)->count();

            $whiteSpotsPercent = $totalCount > 0
                ? round(($whiteSpotsCount / $totalCount) * 100, 1)
                : 0;
        }

        $stats = [
            'density'               => $totalCount,
            'white_spots_percent'  => $whiteSpotsPercent,
            'new_clients'           => rand(20, 30),
            'coverage'              => rand(60, 70),
        ];

        return view('dashboard.index', compact('stats', 'regions'));
    }
}
