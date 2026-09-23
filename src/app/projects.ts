/** Original placeholder portfolio — fictional studio, fictional clients. */
export type Category = 'websites' | 'installations' | 'xr' | 'multiplayer' | 'games';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'websites', label: 'Websites' },
  { id: 'installations', label: 'Installations' },
  { id: 'xr', label: 'XR / VR / AI' },
  { id: 'multiplayer', label: 'Multiplayer' },
  { id: 'games', label: 'Games' },
];

export interface Project {
  slug: string;
  title: string;
  kicker: string;
  client: string;
  year: number;
  category: Category;
  description: string;
  /** three palette stops for the procedural media, hex */
  palette: [string, string, string];
  /** media shader variant */
  style: number;
}

export const PROJECTS: Project[] = [
  {
    slug: 'tidal-archive',
    title: 'Tidal Archive',
    kicker: '[ ~ ≈ ~ ]',
    client: 'Northwind Museum',
    year: 2026,
    category: 'installations',
    description:
      'A forty‑metre projection wall that reads live tide gauges from twelve harbours and paints them as slow, breathing sediment. Visitors disturb the layers with their shadows.',
    palette: ['#0d3b3f', '#58c2b5', '#e8f4e0'],
    style: 0,
  },
  {
    slug: 'glass-orchard',
    title: 'Glass Orchard',
    kicker: 'VERDANT',
    client: 'Verdant Audio',
    year: 2025,
    category: 'websites',
    description:
      'An album launch site where every track grows a translucent tree. Listening longer lets the orchard ripen; fans share seeds that plant their tree in a friend’s grove.',
    palette: ['#1d3b1c', '#8fd18b', '#f3e6b0'],
    style: 1,
  },
  {
    slug: 'signal-bloom',
    title: 'Signal Bloom',
    kicker: '/// LIVE',
    client: 'Pulse Festival',
    year: 2025,
    category: 'multiplayer',
    description:
      'A browser venue for a 12‑hour virtual festival. Up to 60k concurrent visitors shared one field of light that bloomed with the crowd’s movement and the live set’s spectrum.',
    palette: ['#2a0f3d', '#d45ad8', '#ffd2f4'],
    style: 2,
  },
  {
    slug: 'parallel-garden',
    title: 'Parallel Garden',
    kicker: 'XR',
    client: 'Oda Botanical',
    year: 2024,
    category: 'xr',
    description:
      'A mixed‑reality walk through a glasshouse where each plant has a speculative twin from another climate. Built for headsets and phones from one codebase.',
    palette: ['#0f2a2a', '#4fe0b0', '#c4fff0'],
    style: 3,
  },
  {
    slug: 'kiln',
    title: 'Kiln',
    kicker: 'PLAY',
    client: 'Emberline Games',
    year: 2024,
    category: 'games',
    description:
      'A tactile browser game about firing pottery. Temperature, glaze and chance combine into a glaze pattern nobody else will ever get.',
    palette: ['#3a120a', '#e3702f', '#ffe0b8'],
    style: 4,
  },
  {
    slug: 'low-orbit-radio',
    title: 'Low Orbit Radio',
    kicker: '◌ 88.1',
    client: 'Halo Broadcast',
    year: 2024,
    category: 'websites',
    description:
      'A radio station that only plays while a real satellite is above your horizon. The site tracks its pass in realtime and tunes the static accordingly.',
    palette: ['#0b1636', '#5a7cff', '#d8e2ff'],
    style: 5,
  },
  {
    slug: 'echo-choir',
    title: 'Echo Choir',
    kicker: '((( • )))',
    client: 'Civic Arts Council',
    year: 2023,
    category: 'multiplayer',
    description:
      'Visitors hum into their phones; the voices are pitched into a shared, evolving chord projected onto a concert hall façade during a winter festival.',
    palette: ['#1b1036', '#9b7bff', '#ffe3a8'],
    style: 6,
  },
  {
    slug: 'salt-and-static',
    title: 'Salt & Static',
    kicker: 'INSTALL',
    client: 'Harbour Biennale',
    year: 2023,
    category: 'installations',
    description:
      'A room of suspended salt crystals lit by lasers that react to the humidity outside. The crystals slowly grow over the exhibition’s three months.',
    palette: ['#262626', '#cfcfcf', '#ff5a6a'],
    style: 7,
  },
  {
    slug: 'driftwood-protocol',
    title: 'Driftwood Protocol',
    kicker: '> RUN',
    client: 'Tidewater Interactive',
    year: 2023,
    category: 'games',
    description:
      'A cooperative puzzle game played across two browsers — one player sees the map, the other the tide. Neither can finish alone.',
    palette: ['#10231f', '#b98a4e', '#e8d2a8'],
    style: 8,
  },
  {
    slug: 'aurora-ledger',
    title: 'Aurora Ledger',
    kicker: 'AI / XR',
    client: 'Polar Institute',
    year: 2022,
    category: 'xr',
    description:
      'Twenty years of auroral readings reconstructed as a volumetric sky you can stand inside. A small language model narrates what each storm disrupted on the ground.',
    palette: ['#051a1f', '#2de0a0', '#b98cff'],
    style: 9,
  },
  {
    slug: 'paper-moons',
    title: 'Paper Moons',
    kicker: '☾ ☾ ☾',
    client: 'Folio Press',
    year: 2022,
    category: 'websites',
    description:
      'A children’s book that folds itself. Each page is a physically simulated paper sculpture that readers can crease, unfold and send to someone.',
    palette: ['#2b2130', '#e7b7c8', '#fff4ea'],
    style: 10,
  },
  {
    slug: 'deep-field-atlas',
    title: 'Deep Field Atlas',
    kicker: '[ ✦ ]',
    client: 'Observatory Network',
    year: 2021,
    category: 'installations',
    description:
      'A planetarium dome show generated live from telescope survey data, rendered at 8K across six projectors and re‑composed every night.',
    palette: ['#070b1a', '#3c5bd6', '#f6c26b'],
    style: 11,
  },
];

export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug) ?? null;
