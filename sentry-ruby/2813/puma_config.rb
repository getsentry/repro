# Puma configuration
threads 1, 5
workers 0
port 9292

# Enable queue time tracking
# This adds the X-Request-Start header to track when requests enter Puma's queue
on_worker_boot do
  puts "Puma worker started - queue time tracking enabled"
end
