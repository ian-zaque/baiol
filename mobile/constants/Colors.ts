const spotify = {
  text: '#FFFFFF',
  background: '#121212',
  tint: '#1AADEA',
  tabIconDefault: '#B3B3B3',
  tabIconSelected: '#1AADEA',
  card: '#181818',
  elevated: '#282828',
  input: '#2A2A2A',
  muted: '#B3B3B3',
  danger: '#F3727F',
  gold: '#7ED6FA',
  greenSoft: '#4EC4F5',
  greenDark: '#083A78',
  border: '#282828',
  white: '#FFFFFF',
  onTint: '#FFFFFF',
  sidebar: '#000000',
};

export default {
  light: spotify,
  dark: spotify,
};

export const COVER_COLORS = [
  ['#3EC6F5', '#1496E0', '#0A4F9C'],
  ['#4ECBF8', '#1A9FE6', '#0C58A8'],
  ['#2EB6EE', '#0E88D4', '#084888'],
  ['#5AD0FA', '#20A8EA', '#0E62B0'],
  ['#36B8F0', '#128ED8', '#0A5296'],
  ['#48C6F6', '#1898E2', '#0B56A0'],
] as const;

export function midColor(lightest: string, darkest: string) {
  const light = lightest.replace('#', '');
  const dark = darkest.replace('#', '');
  const channel = (start: number) =>
    Math.round((parseInt(light.slice(start, start + 2), 16) + parseInt(dark.slice(start, start + 2), 16)) / 2)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

export function coverMid(id: string) {
  const colors = coverColors(id);
  return midColor(colors[0], colors[2]);
}

export function coverColors(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % COVER_COLORS.length;
  }
  return COVER_COLORS[hash] ?? COVER_COLORS[0];
}
