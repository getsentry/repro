# frozen_string_literal: true

rows = File.readlines(ARGV.fetch(0), chomp: true).map { |l| l.split("\t") }
abort "no scheduled jobs ran - check sidekiq-*.log" if rows.empty?

puts format("%-5s %-5s %-9s %-12s %-13s %s", "boot", "jobs", "trace_ids", "sample_rands", "sampled", "trace_id / sample_rand")
rows.group_by(&:first).sort_by { |b, _| b.to_i }.each do |boot, rs|
  traces = rs.map { |r| r[1] }.uniq
  rands = rs.map { |r| r[2] }.uniq
  sampled = rs.map { |r| r[3] }.tally.map { |k, v| "#{k}=#{v}" }.join(",")
  puts format("%-5s %-5d %-9d %-12d %-13s %s", boot, rs.size, traces.size, rands.size, sampled,
              traces.size == 1 ? "#{traces.first} / #{rands.first}" : "(#{traces.size} distinct)")
end

per_boot_shared = rows.group_by(&:first).values.all? { |rs| rs.map { |r| r[1] }.uniq.size == 1 && rs.size > 1 }
puts
if per_boot_shared
  puts "REPRODUCED: every scheduled job within a boot shares one trace_id/sample_rand, " \
       "so the sampling decision is all-or-nothing per process."
else
  puts "NOT REPRODUCED: scheduled jobs got distinct traces (expected behaviour)."
end
