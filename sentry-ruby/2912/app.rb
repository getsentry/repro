require "rails"
require "action_controller/railtie"
require "sentry-ruby"
require "sentry-rails"

class ReproApp < Rails::Application
  config.load_defaults 8.0
  config.eager_load = false
  config.logger = Logger.new($stdout)
  config.secret_key_base = "test-secret-key-base-for-reproduction"

  routes.draw do
    get "/" => "home#index"
  end
end

# Initialize Sentry — this is what triggers the warning.
# The premature load hook warning only appears when Sentry.initialized? is true,
# because extend_controller_methods in the railtie is guarded by that check.
Sentry.init do |config|
  config.dsn = ENV.fetch("SENTRY_DSN", "")
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = 0.1
end

class HomeController < ActionController::Base
  def index
    render plain: "Hello from reproduction app"
  end
end

class LiveController < ActionController::Base
  include ActionController::Live

  def stream
    response.headers["Content-Type"] = "text/event-stream"
    3.times do |i|
      response.stream.write "data: chunk #{i}\n\n"
    end
  ensure
    response.stream.close
  end
end

Rails.application.initialize!

# Check whether Sentry's StreamingReporter is prepended to ActionController::Live
ancestors = ActionController::Live.ancestors
streaming_reporter = ancestors.find { |a| a.name&.include?("StreamingReporter") }

puts "\n--- ActionController::Live ancestors (first 10) ---"
ancestors.first(10).each { |a| puts "  #{a}" }
puts
if streaming_reporter
  puts "StreamingReporter IS prepended: #{streaming_reporter}"
else
  puts "StreamingReporter is NOT prepended"
end
