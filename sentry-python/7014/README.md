# Reproduction for sentry-python#7014

**Issue:** https://github.com/getsentry/sentry-python/issues/7014

## Description

The `AI (3.10)` CI job fails now and then in `tests/integrations/litellm/test_litellm.py`. The test that fails changes from run to run. Recent example: `test_binary_content_encoding_mixed_content[False-False]`, which failed on master 7 times between Sep 30 and Oct 13, 2026 ([job](https://github.com/getsentry/sentry-python/actions/runs/38237427670/job/114771446502), [job](https://github.com/getsentry/sentry-python/actions/runs/38248860372/job/114809620395)). Each failure shows the same two errors:

```
FAILED ...::test_binary_content_encoding_mixed_content[False-False] - assert 0 == 1   (len(chat_spans))
ERROR  ...::test_binary_content_encoding_mixed_content[False-False] - PytestUnraisableExceptionWarning:
  Exception ignored in thread started by: <bound method Thread._bootstrap of <Thread(ThreadPoolExecutor-76_0, ...)>>
/usr/lib/python3.10/threading.py:1011: in _bootstrap_inner
    _sys.settrace(_trace_hook)
E   RuntimeError: Cannot install a trace function while another trace function is being installed
```

How the failure happens:

1. **The CPython bug.** On CPython < 3.12, `sys.settrace()` is protected by one `static int reentrant` flag shared by the whole process ([python/cpython#98257](https://github.com/python/cpython/issues/98257), fixed in 3.12). That flag stays set while audit hooks run.
2. **The audit hook.** [filelock](https://pypi.org/project/filelock/) 3.30.0 through 4.0.2 registers a Python-level audit hook (`sys.addaudithook(_audit_fork_safety)`) when it is imported. In the litellm test env, `huggingface_hub` imports filelock during the first test.
3. **The tracer.** coverage / pytest-cov calls `threading.settrace(...)`. As a result, every new thread calls `sys.settrace()` inside `Thread._bootstrap_inner()`.
4. **The race.** Thread A can be inside filelock's hook while holding the flag, and the GIL can switch to thread B. When thread B then calls `settrace()`, it raises `RuntimeError`. Thread B dies before it runs its target.
5. **The lost span.** LiteLLM finishes the Sentry `gen_ai.chat` span in a success callback that runs on a `ThreadPoolExecutor`. The tests create a new executor for each test (`reset_litellm_executor`), so it has exactly one worker. If that worker dies, the callback never runs, the span is never finished, and `chat_spans` is empty.

`repro.py` does the same thing without litellm or pytest. In each iteration it creates a transaction and a burst of new single-worker executors. Each executor's only job is `span.finish`. The script then counts callbacks that never ran.

## Steps to Reproduce

Requires [uv](https://docs.astral.sh/uv/). No DSN is needed because events go to an in-memory transport. If you want to send events to a real project, `export SENTRY_DSN=` and change `sentry_sdk.init`.

1. Bug: Python 3.10 with filelock 3.32.4, the version pinned in CI. `repro.py` installs `threading.settrace` itself:
   ```bash
   uv run --python 3.10 --with sentry-sdk==2.72.0 --with filelock==3.32.4 python repro.py
   ```
   Same check under real coverage, like CI does:
   ```bash
   uv run --python 3.10 --with sentry-sdk==2.72.0 --with filelock==3.32.4 --with coverage==7.16.2 \
     python -m coverage run repro.py --no-tracer
   ```
2. Controls, which should exit 0:
   ```bash
   # filelock 4.0.3+ skips the audit hook on CPython < 3.12
   uv run --python 3.10 --with sentry-sdk==2.72.0 --with filelock==4.0.3 python repro.py
   # CPython 3.12 fixed the shared flag
   uv run --python 3.12 --with sentry-sdk==2.72.0 --with filelock==3.32.4 python repro.py
   # no audit hook / no tracer
   uv run --python 3.10 --with sentry-sdk==2.72.0 --with filelock==3.32.4 python repro.py --no-filelock
   uv run --python 3.10 --with sentry-sdk==2.72.0 --with filelock==3.32.4 python repro.py --no-tracer
   ```
3. To measure how often it happens, run it several times:
   ```bash
   for i in $(seq 5); do uv run --python 3.10 --with sentry-sdk==2.72.0 --with filelock==3.32.4 python repro.py --iterations 2000 | grep "never ran"; done
   ```

The script exits 1 and prints `BUG REPRODUCED` when at least one callback was lost.

## Expected Behavior

Every callback submitted to an executor runs, and every `gen_ai.chat` span is finished and sent.

## Actual Behavior

With Python 3.10 and filelock 3.32.4, a small share of executor worker threads die while starting. Their callbacks never run and those spans are lost:

```
filelock 3.32.4
python 3.10.22, executors=32000, 67.3s
worker threads that died in Thread._bootstrap: 14
  e.g. RuntimeError('Cannot install a trace function while another trace function is being installed')
callbacks that never ran (span never finished): 14
gen_ai.chat spans received by transport: 31986/32000
BUG REPRODUCED
```

The same run with filelock 4.0.3 on 3.10, or with filelock 3.32.4 on 3.12, lost **0 of 32000** callbacks.

## Environment

- Python: 3.10.22 (bug); 3.12.15 (control)
- sentry-sdk: 2.72.0
- filelock: 3.32.4 (bug), 4.0.3 (fixed)
- coverage: 7.16.2 (optional; `threading.settrace` stands in for it by default)
- OS: Linux x86_64
