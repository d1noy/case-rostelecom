<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class RegionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Для хакатона разрешаем всем
    }

    public function rules(): array
    {
        return [
            'min_revenue'      => ['nullable', 'numeric', 'min:0'],
            'max_revenue'      => ['nullable', 'numeric', 'min:0'],
            'show_white_spot' => ['sometimes', 'boolean'],
        ];
    }
}
