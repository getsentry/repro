# Reproduction for sentry-ruby redis-auth-credentials-in-telemetry

**SDK:** sentry-ruby v7.0.0
**Linear:** SDK-1226 (no GitHub issue)
**Fix:** https://github.com/getsentry/sentry-ruby/pull/3189

## Description

`Sentry::Redis#parsed_commands` destructures every Redis command as
`command, key, *arguments` and always records `key`. For `AUTH <password>` the
"key" is the password, and for `AUTH <user> <password>` it is the username.
These values end up in `db.redis` span descriptions and in `redis_logger`
breadcrumbs, even with `send_default_pii = false` and
`data_collection.database_query_data = false`.

With `database_query_data` enabled, the full `AUTH <user> <password>` and the
RESP3 handshake `HELLO 3 AUTH <user> <password>` (redis-client, e.g. Sidekiq 7+)
are recorded too.

The leak happens during the normal connection handshake when a password is
configured: both redis-rb 4.x (`Redis::Client#logging`) and redis-rb 5.x
(redis-client middleware) send AUTH through the instrumented path.

## Steps to Reproduce

1. Start a Redis that requires a password and has an ACL user:

   ```bash
   docker run -d --name redis-auth -p 127.0.0.1:6380:6379 redis:7 \
     redis-server --requirepass s3cr3t-default-pass \
     --user acl-user on '>s3cr3t-acl-pass' '~*' '&*' '+@all'
   ```

2. Install dependencies (redis-rb 5.x by default; set `REDIS_RB_VERSION=4.8`
   for the 4.x code path):

   ```bash
   bundle install
   ```

3. Run the reproduction:

   ```bash
   bundle exec ruby repro.rb
   REDIS_RB_VERSION=4.8 bundle update redis && REDIS_RB_VERSION=4.8 bundle exec ruby repro.rb
   ```

   Nothing is sent to Sentry: without `SENTRY_DSN` the script uses a fake DSN
   with `Sentry::DummyTransport` and reads spans and breadcrumbs locally. To
   send events to a real project, `export SENTRY_DSN=...` first.

## Expected Behavior

No Redis credentials (password or username) appear in span descriptions or
breadcrumbs, regardless of `send_default_pii` or `data_collection` settings.

## Actual Behavior

The script exits with status 1 and prints `LEAK` for each scenario.

## Reproduction Evidence

redis-rb 5.4.1 / redis-client 0.31.0, default privacy settings
(`send_default_pii = false`, `database_query_data = false`):

```text
== handshake: Redis.new(password:)
  span:       "AUTH s3cr3t-default-pass"
  breadcrumb: [{"command" => "AUTH", "key" => "s3cr3t-default-pass"}]
  LEAK: s3cr3t-default-pass

== handshake: Redis.new(username:, password:)
  span:       "AUTH acl-user"
  LEAK: acl-user
```

With `database_query_data = true`:

```text
== handshake: Redis.new(username:, password:)
  span:       "AUTH acl-user s3cr3t-acl-pass"
  LEAK: acl-user, s3cr3t-acl-pass

== handshake: RedisClient protocol: 3 (HELLO 3 AUTH ...)
  span:       "HELLO 3 AUTH acl-user s3cr3t-acl-pass"
  LEAK: acl-user, s3cr3t-acl-pass
```

redis-rb 4.8.1 shows the same `AUTH` leaks in every scenario.

With sentry-ruby from getsentry/sentry-ruby#3189, all scenarios print
`OK: no credentials recorded` and the spans are just `AUTH` / `HELLO`.

## Environment

- Ruby: 4.0.9
- sentry-ruby: 7.0.0
- redis-rb: 5.4.1 (redis-client 0.31.0) and 4.8.1
- Redis server: 7.0.8
