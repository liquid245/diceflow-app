# Аналитика DiceFlow - План исполнения

## Фаза A — Клиент (без сервера)

- [x] A1. Добавить installationId и sessionId в IndexedDB (db.ts, storage.ts) + тесты
- [x] A2. Реализовать analytics.ts: ID, очередь, flush/батч, sendBeacon, heartbeat (с учетом visibility) + тесты
- [x] A3. Интеграция в main.tsx (launch/session) + подписка engine.subscribe для событий действий
- [x] A4. Добавить в config.ts настройки analytics (enabled, endpoint, интервалы)

## Фаза B — Сервер

- [x] B1. Создать базу D1 и миграции (schema.sql) + wrangler.toml
- [ ] B2. Реализовать POST /api/analytics/event и POST /api/analytics/heartbeat (с гео из request.cf, валидация, запись в D1)
- [ ] B3. Реализовать GET /api/analytics/stats (агрегаты: active_now, DAU, установки/день, точки, платформы/версии)
- [ ] B4. Настроить Pages Functions + D1 binding в wrangler.toml, добавить rate limiting

## Фаза C — Дашборд

- [ ] C1. Создать страницу /admin с картой (Leaflet+OSM), live-счётчиком и графиками
- [ ] C2. Защитить /admin через Cloudflare Access
- [ ] C3. Добавить поллинг для live-счётчика

## Фаза D — Деплой и проверка

- [ ] D1. Обновить CI (deploy.yml) чтобы деплоить Functions вместе с Pages
- [ ] D2. E2E проверка: отправить событие с устройства и убедиться, что оно появляется в дашборде