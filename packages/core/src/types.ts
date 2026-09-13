/** Режимы взаимоисключающие: это переключатель на четыре положения. */
export type Mode = 'off' | 'all' | 'include' | 'exclude';

export type Verdict = 'PROXY' | 'DIRECT';

export interface Rule {
  /** Хост или маска: example.com, *.example.com */
  pattern: string;
  enabled: boolean;
  note?: string;
}

export interface ProxyTarget {
  host: string;
  port: number;
}

export interface Settings {
  mode: Mode;
  rules: Rule[];
  proxy: ProxyTarget;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'off',
  rules: [],
  proxy: { host: '127.0.0.1', port: 11080 },
};

/**
 * Всегда DIRECT, в любом режиме. Без этого получается петля
 * и отваливается локальная разработка.
 */
export const ALWAYS_DIRECT: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
  '*.local',
  '*.localhost',
];
