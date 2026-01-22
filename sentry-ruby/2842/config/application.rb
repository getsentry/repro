# frozen_string_literal: true

require_relative "boot"

require "rails"
require "action_controller/railtie"

Bundler.require(*Rails.groups)

module ReproApp
  class Application < Rails::Application
    config.load_defaults 8.0
    config.eager_load = false
    config.secret_key_base = "test_secret_key_base_for_reproduction"
  end
end
