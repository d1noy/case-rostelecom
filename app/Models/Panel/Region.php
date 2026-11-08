<?php

namespace App\Models\Panel;

use Illuminate\Database\Eloquent\Model;

class Region extends Model
{
    protected $fillable = [
        'name',
        'latitude',
        'longitude',
        'revenue',
        'is_white_spot',
    ];
}
