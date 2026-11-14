# frozen_string_literal: true

# Reproduction: malformed `sentry-trace` headers influence parent sampling.
#
# `Sentry::PropagationContext::SENTRY_TRACE_REGEXP` makes every capture group
# optional, so headers such as "-1" or "1" match. They carry no trace ID and no
# parent span ID, but they still set `parent_sampled = true`. With a plain
# `traces_sample_rate`, an inherited `parent_sampled` takes precedence over the
# configured rate, so every such request is sampled.
#
# EXPECTED: a header without a valid 32-hex trace ID is ignored, so those
#           requests are sampled at `traces_sample_rate` like requests without
#           any header, and the SDK stays head of trace (populates its own DSC).
# ACTUAL:   "-1" / "1" / "--1" force 100% sampling (and "-0" forces 0%), and the
#           SDK treats the request as a continued trace with an empty, frozen DSC.

require "bundler/setup"
require "sentry-ruby"
require "rack"
require "rack/mock"

SAMPLE_RATE = 0.01
REQUESTS_PER_CASE = 500

$sent = []

Sentry.init do |config|
  # Real DSN optional: every transaction is dropped in before_send_transaction,
  # so nothing is sent either way. A dummy DSN is needed to enable tracing.
  config.dsn = ENV["SENTRY_DSN"].to_s.empty? ? "http://public@localhost/1" : ENV["SENTRY_DSN"]
  config.traces_sample_rate = SAMPLE_RATE
  config.send_client_reports = false
  config.background_worker_threads = 0 # run before_send_transaction inline so counts are exact
  config.sdk_logger = Logger.new(nil)
  config.before_send_transaction = lambda do |event, _hint|
    $sent << event
    nil # count it, never send it
  end
end

app = Rack::Builder.new do
  use Sentry::Rack::CaptureExceptions
  run ->(_env) { [200, { "content-type" => "text/plain" }, ["ok"]] }
end
request = Rack::MockRequest.new(app)

cases = {
  "(no header)"                                  => nil,
  "-1  (malformed)"                              => "-1",
  "1   (malformed)"                              => "1",
  "--1 (malformed)"                              => "--1",
  "well-formed, sampled (expected to inherit)"   => "771a43a4192642f0b136d5159a501700-7c51afd529da4a2a-1",
}

puts "sentry-ruby #{Sentry::VERSION}, traces_sample_rate=#{SAMPLE_RATE}, #{REQUESTS_PER_CASE} requests per case"
puts "extract_sentry_trace(\"-1\") => #{Sentry::PropagationContext.extract_sentry_trace("-1").inspect}"
puts

cases.each do |label, header|
  $sent.clear
  env = header ? { "HTTP_SENTRY_TRACE" => header } : {}
  REQUESTS_PER_CASE.times { request.get("/", env) }

  sample = $sent.first
  dsc = sample&.dynamic_sampling_context
  puts format("%-45s sampled %4d/%d (%5.1f%%)  parent_span_id=%-18s dsc=%s",
              label, $sent.size, REQUESTS_PER_CASE, 100.0 * $sent.size / REQUESTS_PER_CASE,
              sample ? sample.contexts.dig(:trace, :parent_span_id).inspect : "-",
              sample ? dsc.inspect : "-")
end

# Negative direction: "-0" forces sampling OFF even at traces_sample_rate = 1.0.
Sentry.configuration.traces_sample_rate = 1.0
$sent.clear
REQUESTS_PER_CASE.times { request.get("/", { "HTTP_SENTRY_TRACE" => "-0" }) }
puts
puts format("%-45s sampled %4d/%d at traces_sample_rate=1.0", "-0  (malformed)", $sent.size, REQUESTS_PER_CASE)
