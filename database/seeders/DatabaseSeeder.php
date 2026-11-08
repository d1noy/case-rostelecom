<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $email = 'test@example.com';

        if (!User::where('email', $email)->exists()) {
            User::factory()->create([
                'name' => 'Test User',
                'email' => $email,
            ]);
        }

        $this->call([
            ClientSeeder::class,
        ]);
    }
}
