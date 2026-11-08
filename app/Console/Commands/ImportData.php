<?php
// app/Console/Commands/ImportData.php  (без maatwebsite, читает обычные CSV)
// php artisan data:import
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportData extends Command
{
    protected $signature = 'data:import
        {--companies=storage/app/companies.csv}
        {--investments=storage/app/investments.csv}';
    protected $description = 'Импорт компаний и инвестпроектов из CSV';

    private static function industry(?string $okved): string
    {
        $n = (int) substr((string) $okved, 0, 2);
        return match (true) {
            $n >= 1 && $n <= 3   => 'АПК',
            ($n >= 5 && $n <= 9) || $n == 35 => 'ТЭК',
            $n >= 10 && $n <= 33 => 'Промышленность',
            $n >= 41 && $n <= 43 => 'Строительство',
            $n >= 45 && $n <= 47 => 'Торговля',
            $n >= 49 && $n <= 53 => 'Логистика и склады',
            $n >= 55 && $n <= 56 => 'Услуги населению',
            $n >= 58 && $n <= 63 => 'ИТ и связь',
            $n == 68             => 'Недвижимость',
            default              => 'Прочие услуги',
        };
    }

    private static function regionKey(string $s): string
    {
        $s = mb_strtolower(trim($s));
        $s = preg_replace('/^город\s+/u', '', $s);
        $s = preg_replace('/(г\.|район|р-н|ст-ца|п\.|с\.|х\.)/u', '', $s);
        return trim(preg_replace('/\s+/u', ' ', $s));
    }

    private function regionId(?string $name): ?int
    {
        $name = trim((string) $name);
        if ($name === '') return null;
        $key = self::regionKey($name);
        if ($key === '') return null;
        $row = DB::table('regions')->where('key', $key)->first();
        if ($row) return $row->id;
        return DB::table('regions')->insertGetId([
            'name' => $name, 'key' => $key,
            'type' => str_starts_with($name, 'г.') ? 'city' : 'district',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    /** Читает CSV и отдаёт строки как ассоциативные массивы по заголовкам */
    private function rows(string $path): \Generator
    {
        $h = fopen(base_path($path), 'r');
        if (!$h) throw new \RuntimeException("Не найден файл $path");
        $head = fgetcsv($h);
        $head[0] = ltrim($head[0], "\xEF\xBB\xBF"); // убрать BOM, если есть
        while (($r = fgetcsv($h)) !== false) {
            if (count($r) === count($head)) yield array_combine($head, $r);
        }
        fclose($h);
    }

    public function handle(): int
    {
        $cat = ['Микропредприятие' => 'micro', 'Малое предприятие' => 'small', 'Среднее предприятие' => 'medium'];
        $n = 0;
        foreach ($this->rows($this->option('companies')) as $r) {
            DB::table('companies')->updateOrInsert(['inn' => $r['inn']], [
                'ogrn' => $r['ogrn'] ?: null,
                'name' => $r['name'],
                'okved' => $r['okved'] ?: null,
                'industry_code' => substr($r['okved'], 0, 2) ?: null,
                'industry' => self::industry($r['okved']),
                'category' => $cat[$r['category']] ?? null,
                'region_id' => $this->regionId($r['district'] ?: ($r['city'] ?: $r['settlement'])),
                'city' => $r['city'] ?: ($r['settlement'] ?: null),
                'employees' => $r['employees'] !== '' ? (int) $r['employees'] : null,
                'registered_at' => $r['registered_at'] ?: null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $n++;
        }
        $this->info("Компаний: $n");

        DB::table('investments')->delete();
        $m = 0;
        foreach ($this->rows($this->option('investments')) as $r) {
            DB::table('investments')->insert([
                'region_id' => $this->regionId($r['municipality']),
                'curator' => $r['curator'] ?: null,
                'is_key' => (bool) $r['is_key'],
                'initiator' => $r['initiator'] ?: null,
                'title' => $r['title'],
                'start_year' => $r['start_year'] !== '' ? (int) $r['start_year'] : null,
                'end_year' => $r['end_year'] !== '' ? (int) $r['end_year'] : null,
                'sum_mln' => $r['sum_mln'] !== '' ? $r['sum_mln'] : null,
                'jobs' => $r['jobs'] !== '' ? (int) $r['jobs'] : null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $m++;
        }
        $this->info("Инвестпроектов: $m");
        return self::SUCCESS;
    }
}
