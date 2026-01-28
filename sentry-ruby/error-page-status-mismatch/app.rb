require 'bundler/setup'
require 'action_controller/railtie'
require 'sentry-rails'

class TestApp < Rails::Application
  config.root = __dir__
  config.session_store :cookie_store, key: '_test_session'
  config.secret_key_base = 'secret'

  # KEY CONFIGURATION: Enable error pages to reproduce the issue
  # When these are enabled, Rails' ShowExceptions middleware renders error pages
  # and this can cause status code mismatches in Sentry events
  config.consider_all_requests_local = false
  config.action_dispatch.show_exceptions = true

  # Sentry configuration with Spotlight for local event inspection
  config.before_initialize do
    Sentry.init do |config|
      # Use localhost DSN to avoid external requests
      config.dsn = ENV['SENTRY_DSN'] || 'http://12345:67890@localhost:8969/42'
      config.breadcrumbs_logger = [:active_support_logger, :http_logger]
      config.traces_sample_rate = 1.0
      config.environment = 'reproduction'

      # Enable Spotlight for local event inspection
      # This will send events to http://localhost:8969/stream
      config.spotlight = true

      # Debug hook to see what Sentry captures in the terminal
      config.before_send = lambda do |event, hint|
        puts "\n" + "=" * 60
        puts "SENTRY EVENT CAPTURED - Check Spotlight UI at http://localhost:8969"
        puts "=" * 60
        puts "Exception: #{event.exception&.values&.first&.type rescue 'N/A'}"
        puts "Message: #{event.exception&.values&.first&.value rescue 'N/A'}"

        # This is the KEY field - what status code does Sentry report?
        if event.request
          puts "Request URL: #{event.request.url}"
          puts "Request method: #{event.request.method}"
        end

        puts "\nBreadcrumbs (#{event.breadcrumbs&.count || 0}):"
        event.breadcrumbs&.each do |bc|
          puts "  [#{bc.category}] status: #{bc.data[:status] if bc.data}"
        end

        # Print full event contexts to see where status code is stored
        puts "\nEvent Contexts:"
        event.contexts.each do |key, value|
          puts "  #{key}: #{value.inspect}"
        end

        puts "=" * 60
        puts ""

        event
      end
    end
  end

  config.logger = Logger.new(STDOUT)
  config.log_level = :info

  routes.append do
    get '/blob-not-found', to: 'test#blob_not_found'
    get '/routing-error', to: 'test#routing_error'
    get '/standard-404', to: 'test#standard_404'
  end

  config.eager_load = false
end

# Custom exception to simulate ActiveStorage behavior
class BlobNotFoundError < StandardError
end

# Configure Rails to treat BlobNotFoundError as a 404
TestApp.config.action_dispatch.rescue_responses["BlobNotFoundError"] = :not_found

class TestController < ActionController::Base
  # Simulates ActiveStorage::Blobs::RedirectController#show behavior
  # This should return 404, but may be reported as 500 in Sentry
  def blob_not_found
    logger.info "TestController#blob_not_found - raising BlobNotFoundError"
    raise BlobNotFoundError, "Blob with signed_id not found"
  end

  # Simulates a routing error (should be 404)
  def routing_error
    logger.info "TestController#routing_error - raising ActionController::RoutingError"
    raise ActionController::RoutingError, "No route matches"
  end

  # Standard 404 response
  def standard_404
    logger.info "TestController#standard_404 - rendering 404"
    render file: "#{Rails.root}/public/404.html", status: :not_found, layout: false
  end
end

TestApp.initialize!
