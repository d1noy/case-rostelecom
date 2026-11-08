FROM php:8.4-apache

# Установка системных зависимостей и расширений PHP для MySQL
RUN apt-get update && apt-get install -y \
        libpng-dev \
        libxml2-dev \
        libzip-dev \
        git \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/* \
    && docker-php-ext-install pdo_mysql mysqli gd zip exif \
    && a2enmod rewrite

WORKDIR /var/www/html

# Копируем конфиг Apache, если он у тебя есть
COPY ./docker/apache/000-default.conf /etc/apache2/sites-available/000-default.conf

ENTRYPOINT ["/bin/sh", "-c", "a2enmod rewrite && service apache2 restart && tail -f /dev/null"]
