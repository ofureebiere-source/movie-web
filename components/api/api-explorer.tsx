'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Endpoint {
  method: 'GET';
  path: string;
  summaryKey: string;
  params: { name: string; required?: boolean }[];
}

/**
 * The endpoints this app exposes to the browser. Kept here rather than fetched
 * so the page renders with no network round-trip and cannot show a stale list.
 */
const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/catalog/{path}',
    summaryKey: 'catalog',
    params: [{ name: 'query', required: true }, { name: 'page' }, { name: 'type' }],
  },
  {
    method: 'GET',
    path: '/api/stream',
    summaryKey: 'stream',
    params: [{ name: 'id', required: true }, { name: 'type', required: true }],
  },
  {
    method: 'GET',
    path: '/api/image',
    summaryKey: 'image',
    params: [{ name: 'url', required: true }, { name: 'w' }, { name: 'q' }],
  },
];

/**
 * A live endpoint explorer, in the spirit of the upstream service page: pick an
 * endpoint, edit the query, and see the real JSON come back from this same
 * deployment. Read-only GETs only, so there is nothing here that can mutate
 * anything.
 */
export default function ApiExplorer() {
  const t = useTranslations('api');
  const [active, setActive] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  const endpoint = ENDPOINTS[active];

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const buildUrl = () => {
    const filled = Object.entries(values).filter(([, v]) => v.trim().length > 0);
    if (endpoint.summaryKey === 'catalog') {
      // The catalogue route takes the upstream path in the URL itself.
      const upstream = values['path']?.trim() || 'api/search';
      const rest = filled
        .filter(([k]) => k !== 'path')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      return `/api/catalog/${upstream}${rest ? `?${rest}` : ''}`;
    }
    return `${endpoint.path}${
      filled.length
        ? `?${filled
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&')}`
        : ''
    }`;
  };

  const run = async () => {
    setStatus('loading');
    setResult('');
    try {
      const res = await fetch(buildUrl());
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Not JSON — show it as it came.
      }
      setResult(pretty.slice(0, 6000));
      setStatus(res.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
      setResult(t('requestFailed'));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Endpoint list */}
      <div className="space-y-2">
        {ENDPOINTS.map((e, i) => (
          <button
            key={e.path}
            type="button"
            onClick={() => {
              setActive(i);
              setValues({});
              setResult('');
              setStatus('idle');
            }}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${
              i === active
                ? 'border-line bg-surface-card'
                : 'border-line bg-surface-secondary hover:border-line-hover'
            }`}
          >
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
              {e.method}
            </span>
            <span className="truncate font-mono text-xs text-content-main">{e.path}</span>
          </button>
        ))}
      </div>

      {/* Request / response */}
      <div className="space-y-3 rounded-xl border border-line bg-surface-card p-4">
        <p className="text-xs leading-relaxed text-content-muted">
          {t(`endpoints.${endpoint.summaryKey}`)}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {endpoint.summaryKey === 'catalog' && (
            <label className="space-y-1 sm:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-content-muted/70">
                {t('upstreamPath')}
              </span>
              <input
                value={values['path'] ?? ''}
                onChange={(e) => setValue('path', e.target.value)}
                placeholder="api/search"
                className="w-full rounded-lg border border-line bg-surface-primary px-3 py-2 font-mono text-xs text-content-main outline-none focus:border-line-hover"
              />
            </label>
          )}
          {endpoint.params.map((p) => (
            <label key={p.name} className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wide text-content-muted/70">
                {p.name}
                {p.required && <span className="text-rose-400"> *</span>}
              </span>
              <input
                value={values[p.name] ?? ''}
                onChange={(e) => setValue(p.name, e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-primary px-3 py-2 font-mono text-xs text-content-main outline-none focus:border-line-hover"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={run}
          className="rounded-lg border border-line bg-content-main px-3 py-1.5 text-xs font-bold text-surface-primary transition-opacity hover:opacity-90"
        >
          {t('send')}
        </button>

        <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-surface-primary p-3 font-mono text-[11px] leading-relaxed text-content-soft">
          {status === 'loading' ? t('sending') : result || `// ${t('responsePlaceholder')}`}
        </pre>
      </div>
    </div>
  );
}
