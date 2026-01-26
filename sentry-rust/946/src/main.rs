use std::thread;
use std::time::Duration;

use tracing::span;
use tracing::Subscriber;
use tracing_subscriber::layer::Context;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::registry::LookupSpan;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::Layer;

/// A debug layer that logs all span lifecycle events to see exactly what tracing is doing
struct DebugLayer;

impl<S> Layer<S> for DebugLayer
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    fn on_new_span(&self, attrs: &span::Attributes<'_>, id: &span::Id, ctx: Context<'_, S>) {
        let span = ctx.span(id).unwrap();
        let parent = span.parent().map(|p| p.name()).unwrap_or("(none)");
        eprintln!(
            "[TRACING] NEW_SPAN: name={:?}, id={:?}, parent={}, thread={:?}",
            attrs.metadata().name(),
            id,
            parent,
            thread::current().id()
        );
    }

    fn on_enter(&self, id: &span::Id, ctx: Context<'_, S>) {
        let span = ctx.span(id).unwrap();
        eprintln!(
            "[TRACING] ENTER: name={:?}, id={:?}, thread={:?}",
            span.name(),
            id,
            thread::current().id()
        );
    }

    fn on_exit(&self, id: &span::Id, ctx: Context<'_, S>) {
        let span = ctx.span(id).unwrap();
        eprintln!(
            "[TRACING] EXIT: name={:?}, id={:?}, thread={:?}",
            span.name(),
            id,
            thread::current().id()
        );
    }

    fn on_close(&self, id: span::Id, ctx: Context<'_, S>) {
        let span = ctx.span(&id).unwrap();
        eprintln!(
            "[TRACING] CLOSE: name={:?}, id={:?}, thread={:?}",
            span.name(),
            id,
            thread::current().id()
        );
    }
}

fn main() {
    // Initialize Sentry - DSN should be set via SENTRY_DSN environment variable
    let _guard = sentry::init((
        std::env::var("SENTRY_DSN").unwrap_or_default(),
        sentry::ClientOptions {
            release: sentry::release_name!(),
            traces_sample_rate: 1.0,
            debug: true,
            ..Default::default()
        },
    ));

    // Initialize tracing with Sentry layer and our debug layer
    tracing_subscriber::registry()
        .with(DebugLayer)
        .with(sentry_tracing::layer())
        .init();

    // Create a root span "foo" that will become the Sentry transaction
    // This span will be entered by multiple threads
    let span = tracing::info_span!("foo");
    let span2 = span.clone();

    // Thread 1: Enter the span and create a child span "bar"
    let handle1 = thread::spawn(move || {
        let _guard = span.enter();
        eprintln!("--- Thread 1: Entered span 'foo' ---");

        // Create child span "bar" - this should appear as a child of "foo"
        let _bar_span = tracing::info_span!("bar").entered();
        eprintln!("--- Thread 1: Entered span 'bar' ---");

        // Sleep to allow overlap with thread 2
        thread::sleep(Duration::from_millis(100));

        eprintln!("--- Thread 1: Exiting spans ---");
    });

    // Thread 2: Enter the same span and create a child span "baz"
    let handle2 = thread::spawn(move || {
        // Small delay to ensure thread 1 enters first
        thread::sleep(Duration::from_millis(10));

        let _guard = span2.enter();
        eprintln!("--- Thread 2: Entered span 'foo' ---");

        // Create child span "baz" - this should appear as a child of "foo"
        let _baz_span = tracing::info_span!("baz").entered();
        eprintln!("--- Thread 2: Entered span 'baz' ---");

        // Sleep before exiting
        thread::sleep(Duration::from_millis(50));

        eprintln!("--- Thread 2: Exiting spans ---");
    });

    // Wait for both threads to complete
    handle1.join().unwrap();
    handle2.join().unwrap();

    eprintln!("\nExpected span hierarchy:");
    eprintln!("  foo (transaction)");
    eprintln!("    ├── bar");
    eprintln!("    └── baz");
    eprintln!("\nCheck the [TRACING] logs above to see the actual span lifecycle events.");
    eprintln!("If SENTRY_DSN is set, also check your Sentry dashboard.");
}
