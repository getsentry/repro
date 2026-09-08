# frozen_string_literal: true

require_relative "sidekiq_app"

count = Integer(ENV.fetch("JOBS", "12"))
count.times { BurnCpuJob.perform_async(0.3) }
puts "enqueued #{count} jobs on #{REDIS_URL}"
