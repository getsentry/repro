#!/usr/bin/env ruby

# Reproduction for getsentry/sentry-ruby#2912
#
# This script boots a minimal Rails 8.2 app with sentry-rails.
# On Rails 8.2, you should see a deprecation warning:
#
#   :action_dispatch_response was loaded before application initialization.
#   Prematurely executing load hooks will slow down your boot time...
#
# The warning comes from sentry-rails's railtie calling
# ActionController::Live.send(:prepend, ...) inside an on_load(:action_controller) block,
# which eagerly loads ActionDispatch::Response and triggers its load hook prematurely.

require_relative "app"

puts "\n--- Reproduction complete ---"
puts "If you see a ':action_dispatch_response was loaded before application initialization'"
puts "warning above, the bug is reproduced."
puts "If no warning appears, your Rails version may not include the premature load hook detection."
