# frozen_string_literal: true

# Reproduction: Redis AUTH credentials end up in Sentry span descriptions and
# breadcrumbs, even with send_default_pii = false and database query data
# collection disabled.
#
# Sentry::Redis#parsed_commands destructures every command as
#   command, key, *arguments = statement
# and always records `key`. For `AUTH <password>` the "key" is the password,
# for `AUTH <user> <password>` it is the username. For `HELLO 3 AUTH u p` the
# "key" is the protocol version, but the remaining args (AUTH u p) are recorded
# once database query data collection is on.

require "bundler/setup"
require "redis"
require "sentry-ruby"

HOST = ENV.fetch("REDIS_HOST", "127.0.0.1")
PORT = Integer(ENV.fetch("REDIS_PORT", "6380"))
PASSWORD = ENV.fetch("REDIS_PASSWORD", "s3cr3t-default-pass")
ACL_USER = ENV.fetch("REDIS_ACL_USER", "acl-user")
ACL_PASSWORD = ENV.fetch("REDIS_ACL_PASSWORD", "s3cr3t-acl-pass")
SECRETS = [PASSWORD, ACL_USER, ACL_PASSWORD].freeze

def init_sentry(query_data:)
  Sentry.init do |config|
    # Fake DSN + DummyTransport: tracing needs a DSN, but nothing is sent.
    # Set SENTRY_DSN to send the events to a real project instead.
    config.dsn = ENV.fetch("SENTRY_DSN", "") == "" ? "http://public@localhost/1" : ENV["SENTRY_DSN"]
    config.transport.transport_class = Sentry::DummyTransport if ENV.fetch("SENTRY_DSN", "") == ""
    config.traces_sample_rate = 1.0
    config.send_default_pii = false # default
    config.breadcrumbs_logger = [:redis_logger]
    config.data_collection.database_query_data = query_data
    config.sdk_logger = Logger.new(nil)
  end
end

def capture
  Sentry.get_current_scope.clear_breadcrumbs
  transaction = Sentry.start_transaction(name: "repro")
  Sentry.get_current_scope.set_span(transaction)
  yield
  transaction.finish
  spans = transaction.span_recorder.spans.map(&:description).compact
  crumbs = Sentry.get_current_scope.breadcrumbs.to_h[:values].map { |b| b[:data]["commands"] || b[:data][:commands] }
  [spans, crumbs]
end

def report(label, spans, crumbs)
  leaked = SECRETS.select { |s| (spans + crumbs.map(&:inspect)).any? { |t| t.include?(s) } }
  puts "\n== #{label}"
  spans.each { |d| puts "  span:       #{d.inspect}" }
  crumbs.each { |c| puts "  breadcrumb: #{c.inspect}" }
  puts leaked.empty? ? "  OK: no credentials recorded" : "  LEAK: #{leaked.join(", ")}"
  !leaked.empty?
end

puts "sentry-ruby #{Sentry::VERSION}, redis-rb #{Redis::VERSION}" \
     "#{defined?(RedisClient::VERSION) ? ", redis-client #{RedisClient::VERSION}" : ""}, ruby #{RUBY_VERSION}"

leaks = []
[false, true].each do |query_data|
  init_sentry(query_data: query_data)
  puts "\n##### send_default_pii=false, data_collection.database_query_data=#{query_data}"

  # 1. Implicit AUTH during the connection handshake (password only)
  leaks << report("handshake: Redis.new(password:)", *capture {
    Redis.new(host: HOST, port: PORT, password: PASSWORD).ping
  })

  # 2. Implicit AUTH during the connection handshake (ACL username + password)
  leaks << report("handshake: Redis.new(username:, password:)", *capture {
    Redis.new(host: HOST, port: PORT, username: ACL_USER, password: ACL_PASSWORD).ping
  })

  # 3. Explicit AUTH from application code (password only)
  redis = Redis.new(host: HOST, port: PORT, password: PASSWORD)
  redis.ping
  leaks << report("explicit: redis.call('AUTH', password)", *capture { redis.call("AUTH", PASSWORD) })

  # 4. Explicit AUTH from application code (ACL username + password)
  leaks << report("explicit: redis.call('AUTH', user, password)", *capture { redis.call("AUTH", ACL_USER, ACL_PASSWORD) })

  # 5. RESP3 handshake (`HELLO 3 AUTH user password`), as used by redis-client
  #    directly, e.g. Sidekiq 7+. Only applies to redis-rb 5 / redis-client.
  if defined?(RedisClient)
    leaks << report("handshake: RedisClient protocol: 3 (HELLO 3 AUTH ...)", *capture {
      RedisClient.config(host: HOST, port: PORT, protocol: 3, username: ACL_USER, password: ACL_PASSWORD)
                 .new_client.call("PING")
    })
  end
end

puts
if leaks.any?
  puts "BUG REPRODUCED: Redis credentials were recorded in span descriptions/breadcrumbs."
  exit 1
else
  puts "No credentials recorded."
end
