<?php

namespace App\Models\Panel;

use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    protected $table = 'companies';

    protected $fillable = [
        'inn', 'ogrn', 'name', 'okved', 'industry_code', 'industry',
        'category', 'region_id', 'city', 'employees', 'registered_at', 'revenue'
    ];
}
