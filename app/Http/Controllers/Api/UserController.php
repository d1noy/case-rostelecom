<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function me(Request $request)
    {
        $u = $request->user();

        return response()->json([
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'two_factor_confirmed' => ! is_null($u->two_factor_confirmed_at),
        ]);
    }
}
