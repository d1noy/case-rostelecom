<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ClientSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('companies')->update(['is_client' => false]);

        // синтетический флаг «клиент Ростелекома», стабильный по ИНН
        $ids = DB::table('companies')->get(['id', 'inn', 'category'])
            ->filter(function ($c) {
                $share = match ($c->category) {
                    'medium' => 45,
                    'small'  => 30,
                    default  => 12,
                };
                return (crc32($c->inn) % 100) < $share;
            })->pluck('id');

        foreach ($ids->chunk(500) as $chunk) {
            DB::table('companies')->whereIn('id', $chunk)->update(['is_client' => true]);
        }

        // два крупных района без клиентов, чтобы на демо были «белые пятна»
        $demo = DB::table('companies')->whereNotNull('region_id')
            ->groupBy('region_id')
            ->orderByRaw('COUNT(*) DESC')
            ->offset(2)->limit(2)
            ->pluck('region_id');

        DB::table('companies')->whereIn('region_id', $demo)->update(['is_client' => false]);
    }
}
