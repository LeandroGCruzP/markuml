/**
 * Built-in themes and theme resolution for MarkUML.
 */

export const THEMES = {
  light: {
    background: '#ffffff',
    text: '#1e293b',
    mutedText: '#64748b',
    titleText: '#0f172a',
    nodeFill: '#f8fafc',
    nodeHeaderFill: '#e2e8f0',
    nodeStroke: '#475569',
    accentFill: '#eff6ff',
    accentStroke: '#2563eb',
    decisionFill: '#fefce8',
    decisionStroke: '#ca8a04',
    terminalFill: '#f0fdf4',
    terminalStroke: '#16a34a',
    edgeStroke: '#334155',
    lifelineStroke: '#94a3b8',
    labelBg: '#ffffff',
    noteFill: '#fef9c3',
    noteStroke: '#eab308',
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    monoFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    titleFontSize: 16,
    borderRadius: 6,
    padding: 24,
  },
  dark: {
    background: '#0f172a',
    text: '#e2e8f0',
    mutedText: '#94a3b8',
    titleText: '#f8fafc',
    nodeFill: '#1e293b',
    nodeHeaderFill: '#334155',
    nodeStroke: '#64748b',
    accentFill: '#172554',
    accentStroke: '#60a5fa',
    decisionFill: '#422006',
    decisionStroke: '#facc15',
    terminalFill: '#052e16',
    terminalStroke: '#4ade80',
    edgeStroke: '#cbd5e1',
    lifelineStroke: '#475569',
    labelBg: '#0f172a',
    noteFill: '#422006',
    noteStroke: '#eab308',
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    monoFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    titleFontSize: 16,
    borderRadius: 6,
    padding: 24,
  },
};

/**
 * Resolve a theme name or partial theme object into a complete theme.
 * @param {'light' | 'dark' | Record<string, any>} [theme]
 * @returns {typeof THEMES.light}
 */
export function resolveTheme(theme = 'light') {
  if (typeof theme === 'string') {
    return { ...(THEMES[theme] || THEMES.light) };
  }
  const base = theme?.name && THEMES[theme.name] ? THEMES[theme.name] : THEMES.light;
  return { ...base, ...theme };
}
