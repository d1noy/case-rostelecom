<?php
// app/Http/Controllers/Api/RegionsController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RegionsController extends Controller
{
    /** Кэш ID регионов, которые есть на карте */
    private ?array $mappedIds = null;

    /** ID регионов, которые есть на карте (заданы координаты) */
    private function mappedRegionIds(): array
    {
        return $this->mappedIds ??= DB::table('regions')
            ->whereNotNull('lat')
            ->whereNotNull('lon')
            ->pluck('id')
            ->all();
    }

    /** Фильтры: region (название), industry (название или код), category, is_client, min_employees, founded_from */
    private function companies(Request $r)
    {
        $q = DB::table('companies');

        // Только компании регионов, которые есть на карте
        $q->whereIn('region_id', $this->mappedRegionIds());

        if ($r->filled('region') && $r->region !== 'Все регионы') {
            $q->whereIn('region_id', DB::table('regions')->where('name', $r->region)->pluck('id'));
        }
        if ($r->filled('industry') && $r->industry !== 'Все отрасли') {
            $q->where(fn($w) => $w->where('industry', $r->industry)->orWhere('industry_code', $r->industry));
        }
        if ($r->filled('category')) $q->where('category', $r->category);
        if ($r->filled('is_client')) $q->where('is_client', $r->boolean('is_client'));
        if ($r->filled('min_employees')) $q->where('employees', '>=', (int)$r->min_employees);
        if ($r->filled('founded_from')) $q->whereYear('registered_at', '>=', (int)$r->founded_from);
        return $q;
    }

    private function aggregate(Request $r)
    {
        $threeYearsAgo = now()->subYears(3)->format('Y-m-d');

        return $this->companies($r)
            ->selectRaw("region_id,
                COUNT(*) as cnt,
                SUM(CASE WHEN is_client = 1 THEN 1 ELSE 0 END) as clients,
                AVG(COALESCE(employees, 0)) as avg_emp,
                SUM(CASE WHEN registered_at IS NOT NULL AND date(registered_at) >= date(?) THEN 1 ELSE 0 END) as fresh,
                SUM(COALESCE(revenue, CASE category WHEN 'medium' THEN 1000000000 WHEN 'small' THEN 200000000 ELSE 15000000 END)) as rev,
                SUM(CASE WHEN is_client = 0 THEN (CASE category WHEN 'medium' THEN 8 WHEN 'small' THEN 1.5 ELSE 0.15 END) ELSE 0 END) as headroom",
                [$threeYearsAgo])
            ->whereNotNull('region_id')
            ->groupBy('region_id')
            ->get()
            ->keyBy('region_id');
    }

    /** Главная отрасль района: region_id => название */
    private function topIndustries(Request $r)
    {
        return $this->companies($r)->whereNotNull('region_id')
            ->selectRaw('region_id, industry, COUNT(*) c')
            ->groupBy('region_id', 'industry')->get()
            ->groupBy('region_id')->map(fn($g) => $g->sortByDesc('c')->first()->industry);
    }

    private function build(Request $r): array
    {
        $agg = $this->aggregate($r);
        $top = $this->topIndustries($r);
        $inv = DB::table('investments')->selectRaw('region_id, SUM(sum_mln) s')
            ->groupBy('region_id')->pluck('s', 'region_id');
        $max = max(1, (int)$agg->max('cnt'));

        // Средняя доля клиентов по выборке: порог для «белых пятен»
        $totalCnt = (int)$agg->sum('cnt');
        $totalCl = (int)$agg->sum('clients');
        $avgShare = $totalCnt ? $totalCl / $totalCnt : 0;

        // Только регионы, которые есть на карте
        $regions = DB::table('regions')->whereIn('id', $this->mappedRegionIds());
        if ($r->filled('region') && $r->region !== 'Все регионы') {
            $regions->where('name', $r->region);
        }

        return $regions->get()->map(function ($reg) use ($agg, $top, $inv, $max, $avgShare) {
            $a = $agg[$reg->id] ?? null;
            $cnt = (int)($a->cnt ?? 0);
            $cl = (int)($a->clients ?? 0);
            $heat = round($cnt / $max, 2);
            $growth = $cnt ? round(($a->fresh ?? 0) / $cnt, 2) : 0;

            // Белое пятно: заметный рынок, где охват ниже среднего по выборке
            $share = $cnt ? $cl / $cnt : 0;
            $whiteSpot = $cnt >= 5 && $heat >= 0.15 && $share < $avgShare;

            $score = (int)round(100 * (0.5 * $heat + 0.3 * ($cnt ? ($cnt - $cl) / $cnt : 0) + 0.2 * min(1, $growth * 3)));
            $lat = $reg->lat ? (float)$reg->lat : null;
            $lon = $reg->lon ? (float)$reg->lon : null;

            return [
                'id' => $reg->id,
                'name' => $reg->name,
                'type' => $reg->type,
                'lat' => $lat,
                'lon' => $lon,
                'center' => ['lat' => $lat, 'lon' => $lon],
                'industry' => $top[$reg->id] ?? '—',
                'companies_count' => $cnt,
                'clients_count' => $cl,
                'potential_count' => $cnt - $cl,
                'coverage_percent' => $cnt ? (int)round($cl / $cnt * 100) : 0,
                'revenue' => (int)($a->rev ?? 0),
                'headroom_revenue_mln' => (int)round($a->headroom ?? 0),
                'investments_sum_mln' => round((float)($inv[$reg->id] ?? 0), 2),
                'growth_index' => $growth,
                'heat' => $heat,
                'score' => $score,
                'priority_grade' => $score >= 70 ? 'A' : ($score >= 50 ? 'B' : ($score >= 30 ? 'C' : 'D')),
                'is_white_spot' => $whiteSpot,
            ];
        })->sortByDesc('score')->values()->all();
    }

    // GET /api/regions
    public function getRegions(Request $r)
    {
        $data = $this->build($r);
        return response()->json(['data' => $data, 'meta' => ['total' => count($data)]]);
    }

    // GET /api/regions/stats
    public function getRegionsStats(Request $r)
    {
        $regions = collect($this->build($r));
        $active = $regions->where('companies_count', '>', 0);
        $total = $regions->sum('companies_count');
        $clients = $regions->sum('clients_count');
        $by = $this->companies($r)->selectRaw('category, COUNT(*) c')->groupBy('category')->pluck('c', 'category');
        $newClients = $this->companies($r)->where('is_client', true)
            ->where('registered_at', '>=', now()->subYear()->toDateString())->count();

        return response()->json([
            // ключи, которые читает фронт
            'density' => $total,                       // компаний в выборке (площадей в данных нет)
            'white_spots_percent' => $active->count()
                ? round($regions->where('is_white_spot', true)->count() / $active->count() * 100, 1) : 0,
            'new_clients' => $newClients,              // клиенты, зарегистрированные за последний год
            'coverage' => $total ? (int)round($clients / $total * 100) : 0,
            'total_headroom_mln' => $regions->sum('headroom_revenue_mln'),
            'total_potential' => $regions->sum('potential_count'),
            // остальное
            'total_companies' => $total,
            'total_clients' => $clients,
            'total_potential_count' => $regions->sum('potential_count'),
            'total_investments_mln' => round($regions->sum('investments_sum_mln'), 2),
            'white_spots_count' => $regions->where('is_white_spot', true)->count(),
            'by_category' => [
                'micro' => (int)($by['micro'] ?? 0),
                'small' => (int)($by['small'] ?? 0),
                'medium' => (int)($by['medium'] ?? 0),
            ],
            'top_regions' => $regions->sortByDesc('companies_count')->take(5)->map(fn($x) => [
                'id' => $x['id'], 'name' => $x['name'], 'companies_count' => $x['companies_count'],
            ])->values(),
        ]);
    }

    // GET /api/regions/export
    public function exportCsv(Request $r): StreamedResponse
    {
        $rows = $this->build($r);
        return response()->streamDownload(function () use ($rows) {
            $f = fopen('php://output', 'w');
            fwrite($f, "\xEF\xBB\xBF");
            fputcsv($f, ['id', 'name', 'industry', 'companies_count', 'clients_count', 'potential_count',
                'coverage_percent', 'headroom_revenue_mln', 'score', 'priority_grade', 'is_white_spot'], ';');
            foreach ($rows as $x) {
                fputcsv($f, [$x['id'], $x['name'], $x['industry'], $x['companies_count'], $x['clients_count'],
                    $x['potential_count'], $x['coverage_percent'], $x['headroom_revenue_mln'],
                    $x['score'], $x['priority_grade'], $x['is_white_spot'] ? 1 : 0], ';');
            }
            fclose($f);
        }, 'regions.csv', ['Content-Type' => 'text/csv; charset=utf-8']);
    }

    // GET /api/regions/by-industry  (срез по отраслям; ?region_id= для одного района)
    public function getRegionsByIndustry(Request $r)
    {
        $q = $this->companies($r);
        if ($r->filled('region_id')) $q->where('region_id', (int)$r->region_id);

        // Группируем только по названию отрасли, чтобы каждая приходила один раз
        $rows = $q->selectRaw('MIN(industry_code) as industry_code, industry, COUNT(*) as companies_count,
                SUM(CASE WHEN is_client = 1 THEN 1 ELSE 0 END) as clients_count,
                SUM(CASE WHEN registered_at >= ? THEN 1 ELSE 0 END) as fresh', [now()->subYears(3)->toDateString()])
            ->groupBy('industry')->orderByDesc('companies_count')->get()
            ->map(fn($x) => [
                'industry_code' => $x->industry_code,
                'industry' => $x->industry,
                'companies_count' => (int)$x->companies_count,
                'clients_count' => (int)$x->clients_count,
                'penetration_pct' => round((int)$x->clients_count / max(1, (int)$x->companies_count) * 100, 1),
                'growth_index' => round((int)$x->fresh / max(1, (int)$x->companies_count), 2),
            ]);
        return response()->json(['data' => $rows]);
    }

    // GET /api/regions/{id}
    public function getRegionById(Request $r, int $id)
    {
        // Используем метод collect, но добавляем проверку, чтобы не упасть если база пуста
        $buildData = $this->build($r);
        $reg = collect($buildData)->firstWhere('id', $id);
        if (!$reg) return response()->json(['message' => 'Region not found'], 404);

        $industries = $this->companies($r)->where('region_id', $id)
            ->selectRaw('industry_code as code, industry as name, COUNT(*) as count')
            ->groupBy('industry_code', 'industry')->orderByDesc('count')->limit(10)->get();

        $investments = DB::table('investments')->where('region_id', $id)
            ->orderByDesc('sum_mln')->get()->map(fn($i) => [
                'id' => $i->id, 'title' => $i->title, 'initiator' => $i->initiator,
                'start' => $i->start_year, 'end' => $i->end_year,
                'sum_mln' => (float)$i->sum_mln, 'jobs' => $i->jobs,
            ]);

        $avg = $this->companies($r)->where('region_id', $id)->avg('employees');

        return response()->json(array_merge($reg, [
            'avg_employees' => $avg ? round($avg, 1) : null,
            'industries' => $industries,
            'investments' => $investments,
        ]));
    }
}
