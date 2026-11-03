# frozen_string_literal: true

# Reproduction for getsentry/sentry-ruby#3166
#
# With `config.rails.register_error_subscriber = true`, a view error is reported twice:
#   1. Sentry::Rails::CaptureExceptions captures the ActionView::Template::Error (with request context)
#   2. Rails.error (via ActionDispatch::Executor / Reloader) reports its `cause`, which
#      Sentry::Rails::ErrorSubscriber forwards as a second, separately grouped event
#
# Expected: one event per view error, with request context.
# Actual:   two events; in production mode (reloading off) the second has no request URL.
#
# Usage: ruby repro.rb [reloading]   # pass "reloading" to mimic development

require "bundler/setup"
require "action_controller/railtie"
require "sentry-rails"

RELOADING = ARGV.include?("reloading")
EVENTS = []

class ReproApp < Rails::Application
  config.root = __dir__
  config.eager_load = false
  config.enable_reloading = RELOADING
  config.consider_all_requests_local = false
  config.hosts.clear
  config.secret_key_base = "x" * 64
  config.logger = Logger.new(nil)
  routes.append { get "/" => "pages#show" }
end

Sentry.init do |c|
  # Events never leave the process; set SENTRY_DSN to send them to a real project instead.
  c.dsn = ENV.fetch("SENTRY_DSN", "https://key@o0.ingest.sentry.io/0")
  c.transport.transport_class = Sentry::DummyTransport unless ENV["SENTRY_DSN"]
  c.background_worker_threads = 0
  c.rails.register_error_subscriber = true
  c.before_send = lambda do |event, hint|
    EVENTS << "#{hint[:exception].class} url=#{event.request&.url.inspect}"
    ENV["SENTRY_DSN"] ? event : nil
  end
end

class PagesController < ActionController::Base
  def show = render(inline: "<%= raise 'boom' %>")
end

ReproApp.initialize!
ReproApp.call(Rack::MockRequest.env_for("/"))

puts "sentry-ruby #{Sentry::VERSION}, rails #{Rails.version}, reloading=#{RELOADING}"
puts "events (#{EVENTS.size}):"
EVENTS.each { |e| puts "  #{e}" }
puts(EVENTS.size == 1 ? "OK: one event" : "BUG: expected 1 event, got #{EVENTS.size}")
