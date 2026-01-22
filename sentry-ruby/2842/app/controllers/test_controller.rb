# frozen_string_literal: true

class TestController < ApplicationController
  def index
    # Verify user is set in scope
    user_info = Sentry.get_current_scope.user
    puts "\n" + "=" * 60
    puts "SENTRY USER INFO FROM SCOPE:"
    puts "  id: #{user_info[:id]}"
    puts "  email: #{user_info[:email]}"
    puts "  username: #{user_info[:username]}"
    puts "=" * 60

    # Now emit a metric - according to docs, user attributes should be included
    # https://docs.sentry.io/platforms/ruby/guides/rails/metrics/#user-attributes
    Sentry.metrics.count(
      "test.metric.count",
      value: 1,
      attributes: {
        controller: "test",
        action: "index"
      }
    )

    puts "\n" + "=" * 60
    puts "EXPECTED: Metric 'test.metric.count' should include user.id and user.email"
    puts "ACTUAL: Only the attributes passed via 'attributes' parameter are included"
    puts "=" * 60 + "\n"

    render plain: <<~TEXT
      Reproduction for sentry-ruby#2842

      User set in Sentry scope:
        id: #{user_info[:id]}
        email: #{user_info[:email]}
        username: #{user_info[:username]}

      Metric 'test.metric.count' emitted.

      Check console output and Sentry dashboard to verify
      that user attributes are NOT included in the metric.
    TEXT
  end
end
