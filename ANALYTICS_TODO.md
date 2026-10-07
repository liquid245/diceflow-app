# Аналитика DiceFlow - План исполнения

## Фаза A — Клиент (без сервера)

- [x] A1. Добавить installationId и sessionId в IndexedDB (db.ts, storage.ts) + тесты
- [x] A2. Реализовать analytics.ts: ID, очередь, flush/батч, sendBeacon, heartbeat (с учетом visibility) + тесты
- [x] A3. Интеграция в main.tsx (launch/session) + подписка engine.subscribe для событий действий
- [x] A4. Добавить в config.ts настройки analytics (enabled, endpoint, интервалы)

## Фаза B — Сервер

- [x] B1. Создать базу D1 и миграции (schema.sql) + wrangler.toml
- [x] B2. Реализовать POST /api/analytics/event и POST /api/analytics/heartbeat (с гео из request.cf, валидация, запись в D1)
- [x] B3. Реализовать GET /api/analytics/stats (агрегаты: active_now, DAU, установки/день, точки, платформы/версии)
- [x] B4. Настроить Pages Functions + D1 binding в wrangler.toml (binding готов в B1). Rate limiting — правило уровня зоны (применяется вручную, OAuth-токен имеет только `zone:read`):
      Zone `app.diceflow.online` → Security → WAF → Rate limiting rules.
      Name: `analytics-api`; Expression: `(http.request.uri.path contains "/api/analytics/")`; Rate: 60 req / 1 min; Counting: per IP; Action: Block, duration 1 min.

## Фаза C — Дашборд

- [x] C1. Создать страницу /admin с картой (Leaflet+OSM), live-счётчиком и графиками
- [x] C2. Защитить /admin через Cloudflare Access (применяется вручную; OAuth-токен без нужных прав): Zero Trust → Access → Applications → Add self-hosted. Domain `app.diceflow.online`, paths `/admin*` и `/api/analytics/stats`; policy — allow только email разработчика. НЕ закрывать `/api/analytics/event` и `/api/analytics/heartbeat` (их вызывает клиент без аутентификации).
- [x] C3. Добавить поллинг для live-счётчика

## Фаза D — Деплой и проверка

- [x] D1. Деплой Functions вместе с Pages — выбран вариант нативной git-интеграции Cloudflare Pages (без секретов в CI). Git-интеграция к `liquid245/diceflow-app` (ветка `main`) уже настроена, prod-деплой проходит; binding `ANALYTICS_DB` (`de97c6de-…`) и `compatibility_date` заданы в prod-окружении проекта. Build command исправлен на `VITE_BASE=/ npm run build` (было `npm run build` — из-за дефолтного base `/dice_flow/` ассеты на корне `diceflow-app.pages.dev` ломались). Destination — `dist`. GitHub Pages workflow остаётся для второго хостинга.
- [ ] D2. E2E проверка: отправить событие с устройства и убедиться, что оно появляется в дашборде. Блокеры: (1) песочница агента режет TLS к `*.pages.dev`; (2) кастомный домен `app.diceflow.online` не резолвится — зона `diceflow.online` в аккаунте имеет статус `moved` (домен ушёл на другие NS). Для ручной проверки — `https://diceflow-app.pages.dev/admin` отправить событие → обновить дашборд.