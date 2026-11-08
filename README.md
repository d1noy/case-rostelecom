[test@example.com](mailto:test@example.com)\
123
## 1\. Что нужно установить

* [Docker](https://www.docker.com/products/docker-desktop/) и Docker Compose

* Git

* Приложение-аутентификатор на телефоне (Google Authenticator, Authy, Aegis) — для проверки двухфакторки

---

## 2\. Запуск проекта

bash

```
# 1. Клонируем репозиторий
git clone <ссылка-на-репозиторий>
cd <папка-проекта>

# 2. Создаём файл окружения
cp .env.example .env
```

Проверьте в `.env` настройки базы данных (они должны совпадать с `docker-compose.yml`):

env

```
DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=rostelecom
DB_USERNAME=root
DB_PASSWORD=secret
```

bash

```
# 3. Собираем и поднимаем контейнеры
docker compose up -d --build

# 4. Ставим зависимости Laravel
docker compose exec app composer install

# 5. Генерируем ключ приложения
docker compose exec app php artisan key:generate

# 6. Создаём таблицы и заполняем тестовыми данными (сидеры)
docker compose exec app php artisan migrate --seed
```

### Фронтенд

Если фронт в отдельном контейнере, он поднимется вместе с `docker compose up`. Если запускается вручную:

bash

```
cd frontend
npm install
npm run dev
```

### Адреса

#|
|:{header-rows="1"}
||

Что

|

Адрес

||
|#

||

Сайт (фронт)

|

[http://localhost:5173](http://localhost:5173/)

||
||

API (Laravel)

|

[http://localhost:8000](http://localhost:8000/)

||
Порты могут отличаться — смотрите `ports:` в `docker-compose.yml`.

### Полезные команды

bash

```
docker compose ps                 # статус контейнеров
docker compose logs -f app        # логи Laravel
docker compose down               # остановить
docker compose down -v            # остановить и удалить базу (volumes)
docker compose exec app php artisan migrate:fresh --seed   # пересоздать БД с нуля
```

---

## 3\. Сидер: тестовый пользователь для входа и проверки 2FA

Без сидера в базе нет пользователей, поэтому войти на сайт и проверить двухфакторную аутентификацию не получится. Сидер создаёт готового тестового пользователя.

### 3\.1. Создать сидер

bash

```
docker compose exec app php artisan make:seeder UserSeeder
```

Появится файл `database/seeders/UserSeeder.php`.

### 3\.2. Заполнить сидер

Вариант А — **Laravel Fortify** (двухфакторка уже включена у пользователя):

php

```
<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),

                // 2FA: секрет в base32, который вы добавите в приложение-аутентификатор
                'two_factor_secret' => encrypt('JBSWY3DPEHPK3PXP'),
                'two_factor_recovery_codes' => encrypt(json_encode([
                    'recovery-code-1',
                    'recovery-code-2',
                    'recovery-code-3',
                ])),
                'two_factor_confirmed_at' => now(),
            ]
        );
    }
}
```

Вариант Б — **своя реализация 2FA** (например, код приходит в лог/на почту): создайте пользователя без 2FA-полей, а нужные поля (`two_factor_enabled` и т. п.) подставьте по вашей миграции:

php

```
User::updateOrCreate(
    ['email' => 'test@example.com'],
    [
        'name' => 'Test User',
        'password' => Hash::make('password123'),
        'email_verified_at' => now(),
        // 'two_factor_enabled' => true,
    ]
);
```

### 3\.3. Подключить сидер

В `database/seeders/DatabaseSeeder.php`:

php

```
public function run(): void
{
    $this->call([
        UserSeeder::class,
    ]);
}
```

### 3\.4. Запустить

bash

```
# только сидеры
docker compose exec app php artisan db:seed

# или пересоздать всю базу и заполнить
docker compose exec app php artisan migrate:fresh --seed
```

---

## 4\. Как пройти логин и проверить двухфакторку

**Тестовые данные (из сидера):**

#|
|:{header-rows="1"}
||

Поле

|

Значение

||
|#

||

Email

|

`test@example.com`

||
||

Пароль

|

`password123`

||
**Шаги:**

1. Откройте сайт и перейдите на страницу входа.

2. Введите email и пароль выше — вас перебросит на шаг ввода кода 2FA.

3. Добавьте секрет в приложение-аутентификатор:

   * «Добавить аккаунт» → «Ввести ключ вручную»;

   * ключ: `JBSWY3DPEHPK3PXP`, тип — по времени (TOTP).

4. Введите 6-значный код из приложения — вход выполнен.

5. Если приложения под рукой нет, на шаге 2FA можно ввести один из recovery-кодов (`recovery-code-1` и т. д.). Каждый код одноразовый.

**Если код не принимается:**

* проверьте, что на телефоне и в Docker одинаковое время (TOTP очень чувствителен к рассинхрону);

* убедитесь, что секрет в сидере совпадает с тем, что введён в приложении;

* пересоздайте пользователя: `docker compose exec app php artisan migrate:fresh --seed`.

---

## 5\. Частые проблемы

#|
|:{header-rows="1"}
||

Проблема

|

Решение

||
|#

||

`SQLSTATE: Connection refused`

|

БД ещё стартует — подождите 10–20 секунд и повторите `migrate`. Проверьте `DB_HOST=db`

||
||

`Permission denied` в `storage/`

|

`docker compose exec app chmod -R 777 storage bootstrap/cache`

||
||

Порт уже занят

|

Измените порт слева в `ports:` в `docker-compose.yml` или остановите то, что его занимает

||
||

Фронт не видит API

|

Проверьте адрес API в `.env` фронтенда и настройки CORS в Laravel

||
||

Изменения не применяются

|

`docker compose up -d --build` и `php artisan config:clear`

||
