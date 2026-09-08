# frozen_string_literal: true

# Same scenario as threads_repro.rb, but with proposed_fix.rb applied.
require "bundler/setup"
require "sentry-ruby"
require "vernier"
require_relative "proposed_fix"

load File.join(__dir__, "threads_repro.rb")
