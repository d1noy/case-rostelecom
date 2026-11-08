<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RegionsSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('regions')->delete();

        $regions = [
            [
                'name' => 'Москва',
                'revenue' => 5200.50,
                'is_white_spot' => true,
                'geo' => 'POLYGON((37.61 55.75, 37.65 55.75, 37.65 55.71, 37.61 55.71, 37.61 55.75))',
                'status' => 'active', // <-- добавил
            ],
            [
                'name' => 'Санкт-Петербург',
                'revenue' => 3100.25,
                'is_white_spot' => false,
                'geo' => 'POLYGON((30.33 59.93, 30.37 59.93, 30.37 59.89, 30.33 59.89, 30.33 59.93))',
                'status' => 'active',
            ],
            [
                'name' => 'Казань',
                'revenue' => 1800.00,
                'is_white_spot' => true,
                'geo' => 'POLYGON((49.12 55.79, 49.16 55.79, 49.16 55.75, 49.12 55.75, 49.12 55.79))',
                'status' => 'potential', // можно сразу помечать «белые пятна»
            ],
            [
                'name' => 'Екатеринбург',
                'revenue' => 2500.75,
                'is_white_spot' => false,
                'geo' => 'POLYGON((60.60 56.83, 60.64 56.83, 60.64 56.79, 60.60 56.79, 60.60 56.83))',
                'status' => 'active',
            ],
            [
                'name' => 'Новосибирск',
                'revenue' => 4100.10,
                'is_white_spot' => true,
                'geo' => 'POLYGON((82.92 55.03, 82.96 55.03, 82.96 54.99, 82.92 54.99, 82.92 55.03))',
                'status' => 'potential',
            ],
        ];

        DB::table('regions')->insert($regions);
    }
}
