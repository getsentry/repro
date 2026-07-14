require "debug"
require "sentry-ruby"

level = :fiber # :thread to see tag mismatch

Sentry.init do |config|
  config.release = "falcon-fiber"
  config.sdk_logger.level = :debug
  config.hub_isolation_level = level
  config.traces_sample_rate = 1.0
end

# CaptureExceptions clones a fresh hub per request and wraps it in its own scope.
# Falcon runs concurrent requests as sibling fibers on a single reactor thread,
# so a request that yields mid-flight (here a `sleep`) lets its siblings run.
# With :thread storage those siblings share one hub and clobber each other's
# scope; with :fiber storage each request keeps its own.
use Sentry::Rack::CaptureExceptions

run(lambda do |env|
  req = Rack::Request.new(env)
  id = req.params["id"].to_i

  Sentry.set_tags(id: id)

  sleep 0.05 # yield to the reactor so a sibling fiber overwrites the shared hub

  # The exception rides in the raising fiber, so its message stays truthful even
  # when the hub (and thus the `id` tag) has been clobbered by a sibling.
  raise "request level=#{level} id=#{id}"
end)
