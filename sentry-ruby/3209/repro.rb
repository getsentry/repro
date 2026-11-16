require "logger"
require "stringio"
require "sentry-ruby"

# Captures envelopes in memory instead of sending them, so nothing leaves the process.
class InMemoryTransport < Sentry::Transport
  attr_reader :sent

  def initialize(*)
    super
    @sent = []
  end

  def send_data(data, options = {})
    @sent << data
  end
end

log = StringIO.new

Sentry.init do |config|
  config.dsn = "https://public@example.com/1"
  config.background_worker_threads = 0
  config.transport.transport_class = InMemoryTransport
  # The usual production log level: debug messages are hidden.
  config.sdk_logger = Logger.new(log, level: Logger::INFO)
end

# ~1.3 MB of `extra`. Envelope::Item#serialize only drops breadcrumbs and trims
# stack frames, so this event stays above MAX_SERIALIZED_PAYLOAD_SIZE and the
# transport skips it.
Sentry.capture_message("Found records", extra: { ids: (1..200_000).to_a })

transport = Sentry.get_current_client.transport
discarded = transport.discarded_events
warnings = log.string.lines.grep(/\A[WEF],/)

puts "envelopes sent:    #{transport.sent.size}"
puts "discarded events:  #{discarded.inspect}"
puts "warn+ log lines:   #{warnings.size}"
puts log.string unless log.string.empty?

failures = []
failures << "the oversized event was not recorded as a lost event" unless discarded[[:send_error, "error"]].to_i >= 1
failures << "the drop was not logged at warn level or above" if warnings.empty?

if failures.empty?
  puts "OK: the dropped event is visible"
  exit 0
else
  failures.each { |f| puts "BUG: #{f}" }
  exit 1
end
