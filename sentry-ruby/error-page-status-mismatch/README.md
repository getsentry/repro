# Reproduction for sentry-ruby error-page-status-mismatch

**SDK:** sentry-ruby v5.24.0, sentry-rails v5.24.0

## Description

The HTTP status code is reported as 500 Internal Server Error with the Rails SDK (v5.24.0), but breadcrumbs show that the underlying controller actually returns a 404 Not Found. This only occurs when Rails renders its public error pages (`config.action_dispatch.show_exceptions = true` and `config.consider_all_requests_local = false`).

In this reproduction, `TestController#not_found` returns a 404 internally, but the final response is surfaced as a 500 in Sentry, leading to incorrect error classification.

## Steps to Reproduce

1. Install dependencies:
   ```bash
   bundle install
   ```

2. (Optional) Start Spotlight for visual event inspection:
   ```bash
   npx @spotlightjs/spotlight
   ```
   Then open http://localhost:8969 in your browser

3. Start the Rails server:
   ```bash
   bundle exec rackup -p 3001
   ```

4. In another terminal, trigger the issue:
   ```bash
   curl -v http://localhost:3001/blob-not-found
   ```

5. Check the console output for the Sentry event details

The console will show the captured Sentry event with:
- Breadcrumbs showing `status: 404` (correct)
- Trace data showing `http.response.status_code => 500` (incorrect!)

## Expected Behavior

- The controller returns a 404 Not Found status code
- Sentry should capture this as a 404 error (or not capture it at all, depending on configuration)
- The HTTP status code in Sentry event should be 404

## Actual Behavior

- The controller internally returns 404
- Rails error page rendering causes Sentry to report it as **500 Internal Server Error**
- Breadcrumbs show the actual 404, but the event trace data contains `http.response.status_code => 500`
- This leads to incorrect error monitoring and alerting

## Reproduction Evidence

When you run the reproduction and trigger `/blob-not-found`, you'll see:

1. **Rails logs** correctly show: `Completed 404 Not Found`
2. **HTTP response** is: `HTTP/1.1 404 Not Found`
3. **Sentry breadcrumbs** correctly show: `status: 404`
4. **Sentry trace data** **incorrectly** shows: `"http.response.status_code" => 500`

Example output:
```ruby
Breadcrumbs (2):
  [process_action.action_controller] status: 404

Event Contexts:
  trace: {..., data: {"http.response.status_code" => 500}}
```

**This is the bug**: The status code in the Sentry trace is wrong (500) despite everything else correctly showing 404.

## Environment

- Ruby: 3.x (tested with 3.0+)
- Rails: ~7.0
- sentry-ruby: 5.24.0
- sentry-rails: 5.24.0
- OS: Any

## Notes

This issue specifically occurs with:
- `config.consider_all_requests_local = false` (production-like error handling)
- `config.action_dispatch.show_exceptions = true` (Rails renders error pages)

When both are enabled, Rails' error page rendering middleware interferes with the actual status code, causing Sentry to misreport it.
