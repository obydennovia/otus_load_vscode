# Автоматизация нагрузочного тестирования WebTours (VSCode Edition)

## 📌 Цель проекта
Организация и автоматизация процесса нагрузочного тестирования веб-приложения WebTours из среды разработки VS Code. Проект обеспечивает быструю развертку тестовой инфраструктуры «в одну команду», автоматический сбор телеметрии выполнения скриптов и визуализацию метрик производительности.

## 🏗️ Архитектура и стек технологий
Инфраструктура полностью контейнеризирована с помощью Docker и включает в себя:
* **k6** — инструмент для разработки и выполнения сценариев нагрузочного тестирования.
* **InfluxDB (v1.8)** — база данных временных рядов (TSDB) для хранения метрик выполнения запросов.
* **Grafana** — платформа мониторинга. Подключение к базе (Connection) и дашборды импортируются автоматически через механизм Provisioning.
* **Docker / Docker Compose** — оркестрация и управление жизненным циклом контейнеров.

## 📈 Профиль нагрузки и параметры
В репозитории доступны два сценария тестирования, которые могут выполняться как изолированно, так и параллельно:
1. `webtours.js` — комплексный тест производительности веб-приложения WebTours (авторизация, навигация, операции с билетами).
2. `load_ya_www.js` — тест одновременной параллельной генерации HTTP-нагрузки на внешние ресурсы (`yandex_scenario` и `www_scenario`) с логированием в разрезе транзакций.

## 📂 Структура файлов проекта
```text
otus_load_vscode/
├── grafana/
│   └── provisioning/
│       ├── dashboards/
│       │   └── dashboards.yaml   # Конфигурация путей автоимпорта графиков
│       └── datasources/
│           └── datasources.yaml  # Автоподключение InfluxDB (Connections)
├── docker-compose.yml           # Оркестрация контейнеров (InfluxDB + Grafana)
├── dashboard.json               # Экспортированный дашборд с окном по умолчанию Last 1 hour
├── webtours.js                  # Основной нагрузочный скрипт k6 для WebTours
├── load_ya_www.js               # Дополнительный нагрузочный скрипт k6 с транзакциями
└── webtours_users.json          # Файл параметризации (пул тестовых пользователей)
```

## 🚀 Быстрый старт

### 1. Запуск инфраструктуры (InfluxDB + Grafana)
Разверните контейнеры базы данных и системы визуализации из корневой директории проекта:
```bash
docker compose up -d --force-recreate
```
*Благодаря механизму **Provisioning** подключение к базе данных (Connection) и готовый дашборд добавятся в Grafana автоматически при старте контейнера. Дашборд по умолчанию откроется на временном интервале **Last 1 hour**.*

### 2. Одновременный параллельный запуск тестов
Для того чтобы запустить скрипты одновременно одной командой без открытия множества окон, выберите команду под ваш терминал:

#### Вариант А: В PowerShell (Windows)
```powershell
Start-Process powershell "-Command docker run --rm --network=host -i grafana/k6 run --tag test_name=webtours_test --out influxdb=http://localhost:8086/otus_webtours - < webtours.js"; Start-Process powershell "-Command docker run --rm --network=host -i grafana/k6 run --tag test_name=yandex_test --out influxdb=http://localhost:8086/otus_webtours - < load_ya_www.js"
```

#### Вариант Б: В командной строке CMD (Windows)
```cmd
start cmd /c "docker run --rm --network=host -i grafana/k6 run --tag test_name=webtours_test --out influxdb=http://localhost:8086/otus_webtours - < webtours.js" & start cmd /c "docker run --rm --network=host -i grafana/k6 run --tag test_name=yandex_test --out influxdb=http://localhost:8086/otus_webtours - < load_ya_www.js"
```

#### Вариант В: В Git Bash / Linux / WSL
```bash
docker run --rm --network=host -i grafana/k6 run --tag test_name=webtours_test --out influxdb=http://localhost:8086/otus_webtours - < webtours.js & docker run --rm --network=host -i grafana/k6 run --tag test_name=yandex_test --out influxdb=http://localhost:8086/otus_webtours - < load_ya_www.js & wait
```

---

### 📊 3. Разделение результатов и структура метрик в Grafana

В импортированном файле `dashboard.json` уже настроены две независимые панели. Если вы захотите пересоздать или скорректировать их вручную, используйте следующие чистые SQL-запросы:

#### Панель 1: Метрики WebTours
Запрос для первой панели **Time Series** (фильтрация по основному тесту):
```sql
SELECT percentile("value", 95) FROM "http_req_duration" WHERE "expected_response" = 'true' AND "test_name" = 'webtours_test' AND \(timeFilter GROUP BY time(\)__interval), "group"
```
* В поле **Alias by** указано: `$tag_group` (для отображения бизнес-имен транзакций).

#### Панель 2: Метрики Сценариев ya_www
Запрос для второй панели **Time Series** (параллельный вывод `yandex_scenario` и `www_scenario` без сырых URL-адресов):
```sql
SELECT percentile("value", 95) FROM "http_req_duration" WHERE "expected_response" = 'true' AND \(timeFilter GROUP BY time(\)__interval), "group"
```
* В поле **Alias by** указано: `$tag_group` (объединяет сырые страницы в аккуратные группы транзакций `01_Yandex_Home` и `02_Www_Home`).
