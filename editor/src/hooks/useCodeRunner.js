import { useEffect, useRef, useState } from 'react';
import { LAMBDA_URL, REQUEST_TIMEOUT_MS, ERROR_LABEL } from '../constants';

export function useCodeRunner() {
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds, ticks while running

  // AbortController for the in-flight fetch — lets us cancel on unmount.
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Tracks whether the component is still mounted so post-await state
  // updates in runCode can no-op if the user navigated away mid-fetch.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Drive the running-timer at 1Hz while a request is in flight.
  useEffect(() => {
    if (!isRunning) return;
    setElapsed(0);
    const t0 = performance.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - t0) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [isRunning]);

  // Real Lambda execution — fetch the deployed Function URL and translate the
  // response into the same {status, runtime, stdout, error} shape the UI uses.
  const runCode = async (languageApi, code, stdin) => {
    if (!LAMBDA_URL) {
      setOutput({
        status: 'Configuration Error',
        runtime: null,
        stdout: '',
        error:
          'VITE_LAMBDA_URL is not set. Add it to .env.local and restart the dev server.',
      });
      return;
    }

    setIsRunning(true);
    setOutput(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const startedAt = performance.now();
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: languageApi, code, stdin }),
        signal: controller.signal,
      });

      const runtime = Math.round(performance.now() - startedAt);
      let payload;
      try {
        payload = await res.json();
      } catch {
        payload = { error: 'INVALID_RESPONSE', details: await res.text() };
      }

      // Success: { output: "..." }, possibly with the truncation marker.
      if (res.ok && typeof payload.output === 'string') {
        const truncated = payload.output.includes('[OUTPUT_TRUNCATED');
        if (!isMountedRef.current) return;
        setOutput({
          status: truncated ? 'Output Limit Exceeded' : 'Finished',
          runtime,
          compileMs: payload.compile_ms ?? null,
          runMs: payload.run_ms ?? null,
          stdout: payload.output,
          error: null,
        });
        return;
      }

      // Error envelopes from the Lambda — see lambda.py for the full set.
      const errCode = payload.error || `HTTP ${res.status}`;
      const label = ERROR_LABEL[errCode] || errCode;
      // RUNTIME_ERROR carries partial stdout; everything else uses `details`.
      const details = payload.details || '';
      const partialStdout =
        typeof payload.output === 'string' ? payload.output : '';
      if (!isMountedRef.current) return;
      setOutput({
        status: label,
        runtime,
        compileMs: payload.compile_ms ?? null,
        runMs: payload.run_ms ?? null,
        stdout: partialStdout,
        error: details || (partialStdout ? '' : label),
      });
    } catch (e) {
      const runtime = Math.round(performance.now() - startedAt);
      const aborted = e.name === 'AbortError';
      if (!isMountedRef.current) return;
      setOutput({
        status: aborted ? 'Request Timed Out' : 'Network Error',
        runtime,
        stdout: '',
        error: aborted
          ? `No response after ${REQUEST_TIMEOUT_MS / 1000}s. The function may be cold-starting — try again.`
          : e.message || 'Failed to reach the code runner.',
      });
    } finally {
      clearTimeout(timer);
      if (isMountedRef.current) setIsRunning(false);
    }
  };

  return { output, setOutput, isRunning, elapsed, runCode };
}
