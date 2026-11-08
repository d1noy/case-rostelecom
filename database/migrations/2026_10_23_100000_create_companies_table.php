<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('regions', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('key')->unique();
            $t->string('type')->default('district');
            $t->decimal('lat', 9, 6)->nullable();
            $t->decimal('lon', 9, 6)->nullable();
            $t->timestamps();
        });

        Schema::create('companies', function (Blueprint $t) {
            $t->id();
            $t->string('inn', 12)->unique();
            $t->string('ogrn', 15)->nullable();
            $t->string('name');
            $t->string('okved')->nullable();
            $t->string('industry_code', 2)->nullable()->index();
            $t->string('industry')->nullable();
            $t->string('category')->nullable()->index();
            $t->foreignId('region_id')->nullable()->constrained()->nullOnDelete();
            $t->string('city')->nullable();
            $t->decimal('lat', 9, 6)->nullable();
            $t->decimal('lon', 9, 6)->nullable();
            $t->unsignedInteger('employees')->nullable();
            $t->bigInteger('revenue')->nullable();
            $t->date('registered_at')->nullable();
            $t->boolean('is_client')->default(false)->index();
            $t->timestamp('enriched_at')->nullable();
            $t->timestamps();
        });

        Schema::create('investments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('region_id')->nullable()->constrained()->nullOnDelete();
            $t->string('initiator')->nullable();
            $t->text('title');
            $t->string('curator')->nullable();
            $t->boolean('is_key')->default(false);
            $t->unsignedSmallInteger('start_year')->nullable();
            $t->unsignedSmallInteger('end_year')->nullable();
            $t->decimal('sum_mln', 12, 2)->nullable();
            $t->unsignedInteger('jobs')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('investments');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('regions');
    }
};
