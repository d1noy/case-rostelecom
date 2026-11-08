// Dense geographic cluster of business density points across Russian regions
// Matching commercial radar and B2B activity for Rostelecom dashboard

export interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
}

// Generate deterministic cluster of points around a center with realistic dispersion
function generateCluster(
  centerLat: number,
  centerLng: number,
  count: number,
  latSpread: number,
  lngSpread: number,
  baseIntensity = 0.7,
  intensityVar = 0.3
): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Use a simple seeded pseudo-random formula for reproducible, consistent visual heat distribution
  let seed = Math.abs(Math.sin(centerLat * 100 + centerLng * 10)) * 10000;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < count; i++) {
    const u1 = Math.max(0.0001, pseudoRandom());
    const u2 = pseudoRandom();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const randStdNormal2 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    const lat = centerLat + randStdNormal * (latSpread * 0.5);
    const lng = centerLng + randStdNormal2 * (lngSpread * 0.5);
    const intensity = Math.min(1.0, Math.max(0.15, baseIntensity + (pseudoRandom() - 0.5) * intensityVar));
    points.push([lat, lng, intensity]);
  }
  return points;
}

// 1. Moscow and Moscow Agglomeration points
function generateMoscowPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];

  // Moscow City Center (highest core density)
  points.push(...generateCluster(55.7539, 37.6208, 480, 0.05, 0.07, 0.95, 0.1));

  // Moscow City Financial District (Presnya)
  points.push(...generateCluster(55.7495, 37.5374, 260, 0.025, 0.035, 0.98, 0.05));

  // Third Transport Ring & Industrial corridors
  points.push(...generateCluster(55.7900, 37.5800, 140, 0.04, 0.06, 0.75, 0.25)); // Savelovsky / Dynamo
  points.push(...generateCluster(55.7100, 37.6700, 160, 0.04, 0.06, 0.80, 0.20)); // Yuzhnoportovy / ZIL
  points.push(...generateCluster(55.7900, 37.6800, 120, 0.04, 0.06, 0.70, 0.25)); // Sokolniki
  points.push(...generateCluster(55.7200, 37.5600, 120, 0.035, 0.05, 0.75, 0.20)); // Luzhniki / Khamovniki

  // North-West: Khimki & Leningradskoe Highway
  points.push(...generateCluster(55.8893, 37.4447, 180, 0.04, 0.05, 0.85, 0.2));

  // North: Dolgoprudny
  points.push(...generateCluster(55.9300, 37.5100, 90, 0.03, 0.04, 0.70, 0.25));

  // North-East: Mytishchi & Korolev
  points.push(...generateCluster(55.9116, 37.7308, 140, 0.04, 0.05, 0.78, 0.2));

  // East: Reutov & Balashikha
  points.push(...generateCluster(55.7600, 37.8600, 110, 0.04, 0.05, 0.72, 0.25));

  // South-East: Lyubertsy & Kotelniki (Mega Belaya Dacha hub)
  points.push(...generateCluster(55.6600, 37.8600, 150, 0.04, 0.05, 0.82, 0.2));

  // South: Vidnoye & Kashirskoe highway
  points.push(...generateCluster(55.5500, 37.7000, 100, 0.035, 0.045, 0.68, 0.25));

  // South-West: Kommunarka & Rumyantsevo Business Park
  points.push(...generateCluster(55.6350, 37.4350, 130, 0.035, 0.045, 0.85, 0.2));

  // West: Krasnogorsk & Odintsovo
  points.push(...generateCluster(55.8200, 37.3300, 120, 0.04, 0.05, 0.78, 0.2));
  points.push(...generateCluster(55.6700, 37.2700, 90, 0.035, 0.045, 0.70, 0.25));

  return points;
}

// 2. Saint Petersburg points
function generateSpbPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Center: Nevsky Prospect / Gostiny Dvor
  points.push(...generateCluster(59.9343, 30.3351, 280, 0.04, 0.06, 0.90, 0.15));
  // Petrogradsky & Vasilyevsky
  points.push(...generateCluster(59.9600, 30.3100, 140, 0.03, 0.04, 0.80, 0.2));
  points.push(...generateCluster(59.9400, 30.2600, 120, 0.03, 0.04, 0.75, 0.2));
  // Moskovsky Prospect & Pulkovo corridor
  points.push(...generateCluster(59.8500, 30.3200, 130, 0.04, 0.05, 0.82, 0.2));
  // Parnas Industrial Hub (North)
  points.push(...generateCluster(60.0600, 30.3600, 90, 0.035, 0.045, 0.75, 0.25));
  return points;
}

// 3. Kazan points
function generateKazanPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Center & Bauman
  points.push(...generateCluster(55.7961, 49.1064, 220, 0.035, 0.05, 0.92, 0.15));
  // Novo-Savinovsky District (Chistopolskaya)
  points.push(...generateCluster(55.8250, 49.1300, 140, 0.03, 0.045, 0.85, 0.2));
  // IT-Park & Technopark Idea
  points.push(...generateCluster(55.7830, 49.1350, 120, 0.025, 0.035, 0.95, 0.1));
  // Gorki & Industrial Zone
  points.push(...generateCluster(55.7600, 49.1900, 80, 0.035, 0.05, 0.70, 0.25));
  return points;
}

// 4. Novosibirsk points
function generateNovosibirskPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Central District & Krasny Prospekt
  points.push(...generateCluster(55.0084, 82.9357, 240, 0.04, 0.06, 0.90, 0.15));
  // Leninsky District (Marx Square)
  points.push(...generateCluster(54.9830, 82.8950, 130, 0.035, 0.05, 0.82, 0.2));
  // Akademgorodok Technopark
  points.push(...generateCluster(54.8500, 83.1000, 110, 0.03, 0.04, 0.88, 0.15));
  // Tolmachevo Cargo & Logistics Hub
  points.push(...generateCluster(55.0100, 82.6600, 90, 0.035, 0.05, 0.80, 0.2));
  return points;
}

// 5. Ekaterinburg points
function generateEkaterinburgPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Lenin Prospekt & City Center
  points.push(...generateCluster(56.8389, 60.6057, 220, 0.035, 0.05, 0.88, 0.18));
  // Uralmash Industrial Cluster
  points.push(...generateCluster(56.8850, 60.5900, 120, 0.03, 0.04, 0.80, 0.22));
  // Koltsovo Logistics Hub
  points.push(...generateCluster(56.7500, 60.8000, 90, 0.035, 0.05, 0.82, 0.2));
  // VIZ District
  points.push(...generateCluster(56.8300, 60.5400, 80, 0.03, 0.04, 0.75, 0.25));
  return points;
}

// 6. Rostov-on-Don points
function generateRostovPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Center: Bolshaya Sadovaya
  points.push(...generateCluster(47.2357, 39.7015, 200, 0.03, 0.045, 0.88, 0.15));
  // Zapadny District
  points.push(...generateCluster(47.2150, 39.6300, 100, 0.03, 0.04, 0.78, 0.22));
  // Aksay Logistics & Wholesale corridor
  points.push(...generateCluster(47.2700, 39.8600, 90, 0.035, 0.05, 0.82, 0.2));
  return points;
}

// 7. Krasnodar points
function generateKrasnodarPoints(): [number, number, number][] {
  const points: [number, number, number][] = [];
  // Central District (Krasnaya Street)
  points.push(...generateCluster(45.0355, 38.9753, 190, 0.03, 0.04, 0.86, 0.18));
  // Western Bypass & Wholesale
  points.push(...generateCluster(45.0600, 38.9000, 90, 0.035, 0.045, 0.78, 0.22));
  // Airport & Industrial Park
  points.push(...generateCluster(45.0300, 39.1400, 80, 0.03, 0.04, 0.76, 0.24));
  return points;
}

export const MOSCOW_POINTS = generateMoscowPoints();
export const SPB_POINTS = generateSpbPoints();
export const KAZAN_POINTS = generateKazanPoints();
export const NOVOSIBIRSK_POINTS = generateNovosibirskPoints();
export const EKATERINBURG_POINTS = generateEkaterinburgPoints();
export const ROSTOV_POINTS = generateRostovPoints();
export const KRASNODAR_POINTS = generateKrasnodarPoints();

// All points combined across Russia
export const ALL_HEATMAP_POINTS: [number, number, number][] = [
  ...MOSCOW_POINTS,
  ...SPB_POINTS,
  ...KAZAN_POINTS,
  ...NOVOSIBIRSK_POINTS,
  ...EKATERINBURG_POINTS,
  ...ROSTOV_POINTS,
  ...KRASNODAR_POINTS,
];

// Backward-compatible export
export const MOSCOW_HEATMAP_POINTS = ALL_HEATMAP_POINTS;

// Helper to get heat points for a region filter
export function getPointsForRegionFilter(filterName?: string): [number, number, number][] {
  if (!filterName || filterName === 'Все регионы') {
    return ALL_HEATMAP_POINTS;
  }
  const lower = filterName.toLowerCase();
  if (lower.includes('москв') || lower.includes('мо')) {
    return MOSCOW_POINTS;
  }
  if (lower.includes('петербург')) {
    return SPB_POINTS;
  }
  if (lower.includes('казан')) {
    return KAZAN_POINTS;
  }
  if (lower.includes('новосибирск')) {
    return NOVOSIBIRSK_POINTS;
  }
  if (lower.includes('екатеринбург')) {
    return EKATERINBURG_POINTS;
  }
  if (lower.includes('ростов')) {
    return ROSTOV_POINTS;
  }
  if (lower.includes('краснодар')) {
    return KRASNODAR_POINTS;
  }
  if (lower.includes('регионы рф')) {
    return [
      ...SPB_POINTS,
      ...KAZAN_POINTS,
      ...NOVOSIBIRSK_POINTS,
      ...EKATERINBURG_POINTS,
      ...ROSTOV_POINTS,
      ...KRASNODAR_POINTS,
    ];
  }
  return ALL_HEATMAP_POINTS;
}
