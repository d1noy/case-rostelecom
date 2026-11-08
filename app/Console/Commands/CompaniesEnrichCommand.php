<?php
// app/Console/Commands/CompaniesEnrichCommand.php
// php artisan companies:enrich
// Заполняет координаты районов и компаний и синтетический флаг клиентов.
// Внешние API не нужны: все данные берутся из уже импортированных xlsx.
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CompaniesEnrichCommand extends Command
{
    protected $signature = 'companies:enrich {--limit= : не используется, оставлено для совместимости}';
    protected $description = 'Координаты районов и компаний + синтетический флаг клиентов Ростелекома';

    /** ключ (нормализованное имя) => [lat, lon], приблизительные центры */
    private const CENTERS = [
        'азов' => [47.1122, 39.4233], 'азовский' => [47.0300, 39.2500],
        'аксайский' => [47.2685, 39.8722], 'батайск' => [47.1383, 39.7507],
        'белокалитвинский' => [48.1809, 40.7778], 'боковский' => [49.2253, 41.8231],
        'веселовский' => [46.6081, 40.6755], 'волгодонск' => [47.5136, 42.1503],
        'волгодонской' => [47.5500, 42.0500], 'гуково' => [48.0611, 39.9456],
        'донецк' => [48.3343, 39.9498], 'дубовский' => [47.4333, 42.7500],
        'егорлыкский' => [46.5667, 40.6333], 'заветинский' => [47.0900, 43.8800],
        'зерноградский' => [46.8467, 40.3114], 'зимовниковский' => [47.1403, 42.4739],
        'кагальницкий' => [46.9700, 40.1200], 'каменск-шахтинский' => [48.3181, 40.2689],
        'каменский' => [48.3000, 40.1500], 'кашарский' => [49.0500, 41.0000],
        'константиновский' => [47.5822, 41.1017], 'красносулинский' => [47.8794, 40.0775],
        'красный сулин' => [47.8800, 40.0800], 'куйбышевский' => [47.4125, 38.9364],
        'мартыновский' => [47.2700, 41.7300], 'матвеево-курганский' => [47.5569, 38.8656],
        'миллеровский' => [48.9181, 40.3922], 'милютинский' => [49.3500, 41.7000],
        'морозовский' => [48.3544, 41.8336], 'мясниковский' => [47.2500, 39.5800],
        'неклиновский' => [47.2539, 38.9408], 'новочеркасск' => [47.4214, 40.0933],
        'новошахтинск' => [47.7586, 39.9361], 'обливский' => [48.5333, 42.4833],
        'октябрьский' => [47.8300, 40.0000], 'орловский' => [46.8800, 42.0000],
        'песчанокопский' => [46.2000, 41.0700], 'пролетарский' => [46.7000, 41.7167],
        'ремонтненский' => [46.5667, 43.6333], 'родионово-несветайский' => [47.6000, 39.6800],
        'ростов-на-дону' => [47.2357, 39.7015], 'сальский' => [46.4742, 41.5411],
        'семикаракорский' => [47.5167, 40.8000], 'советский' => [48.5500, 42.2000],
        'таганрог' => [47.2362, 38.8969], 'тарасовский' => [48.6967, 40.0625],
        'тацинский' => [48.1994, 41.2517], 'усть-донецкий' => [47.6100, 40.8900],
        'целинский' => [46.5383, 41.0300], 'цимлянский' => [47.6406, 42.0956],
        'чертковский' => [49.3833, 40.1500], 'шахты' => [47.7085, 40.2142],
        'шолоховский' => [49.6325, 41.7222],
    ];

    public function handle(): int
    {
        $this->geo();
        $this->clients();
        return self::SUCCESS;
    }

    private function geo(): void
    {
        foreach (DB::table('regions')->get() as $reg) {
            $c = self::CENTERS[$reg->key] ?? null;
            if ($c) {
                DB::table('regions')->where('id', $reg->id)->update(['lat' => $c[0], 'lon' => $c[1]]);
            } else {
                $this->warn("Нет координат для района: {$reg->name} ({$reg->key})");
            }
        }

        $regions = DB::table('regions')->whereNotNull('lat')->get()->keyBy('id');
        $n = 0;
        foreach (DB::table('companies')->whereNotNull('region_id')->get(['id', 'inn', 'region_id']) as $c) {
            $reg = $regions[$c->region_id] ?? null;
            if (!$reg) continue;

            $radius = $reg->key === 'ростов-на-дону' ? 0.07 : ($reg->type === 'city' ? 0.04 : 0.15);
            $h = crc32($c->inn);
            $angle = ($h % 360) * M_PI / 180;
            $dist = sqrt((($h >> 8) % 1000) / 1000) * $radius;

            DB::table('companies')->where('id', $c->id)->update([
                'lat' => round($reg->lat + $dist * sin($angle), 6),
                'lon' => round($reg->lon + $dist * cos($angle) / 0.68, 6),
                'enriched_at' => now(),
            ]);
            $n++;
        }
        $this->info("Координаты проставлены: $n компаний");
    }

    private function clients(): void
    {
        DB::table('companies')->update(['is_client' => false]);

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
            ->groupBy('region_id')->orderByRaw('COUNT(*) DESC')
            ->offset(2)->limit(2)->pluck('region_id');
        DB::table('companies')->whereIn('region_id', $demo)->update(['is_client' => false]);

        $this->info('Клиентов (синтетика): ' . DB::table('companies')->where('is_client', true)->count());
    }
}
