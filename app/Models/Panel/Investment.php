<?php

namespace App\Models\Panel;

use Illuminate\Database\Eloquent\Model;

class Investment extends Model
{
    protected $table = 'investments';

    protected $fillable = [
        'region_id', 'curator', 'is_key', 'initiator', 'title',
        'start_year', 'end_year', 'sum_mln', 'jobs'
    ];

    protected $casts = [
        'is_key' => 'boolean',
        'sum_mln' => 'float',
    ];
}
