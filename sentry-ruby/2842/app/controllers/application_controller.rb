# frozen_string_literal: true

class ApplicationController < ActionController::Base
  before_action :set_sentry_user

  private

  def set_sentry_user
    # Simulate setting user info as would happen in a real app
    Sentry.set_user(
      id: 12345,
      email: "test@example.com",
      username: "testuser"
    )
  end
end
