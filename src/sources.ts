import type { Source } from './types';

/**
 * Official references the disposal rules are taken from. The app never
 * generates a rule at runtime: every answer comes from the catalog, and the
 * catalog cites these.
 */
export const SOURCES: Source[] = [
  { id: 'limasam', title: 'Limasam — Limpieza de Málaga (municipal waste service)', url: 'https://limpiezademalaga.es/' },
  {
    id: 'limasam-organica',
    title: 'Limasam — Guía de reciclaje: orgánica (brown bin guide)',
    url: 'https://limpiezademalaga.es/wp-content/uploads/2022/06/Organica_Guia_de_reciclaje.pdf',
  },
  { id: 'ecoembes', title: 'Ecoembes — yellow and blue bin system in Spain', url: 'https://www.ecoembes.com/' },
  { id: 'ecovidrio', title: 'Ecovidrio — glass packaging recycling in Spain', url: 'https://www.ecovidrio.es/' },
  { id: 'sigre', title: 'SIGRE — medicine take-back at pharmacies', url: 'https://www.sigre.es/' },
  { id: 'ley-7-2022', title: 'Ley 7/2022 de residuos y suelos contaminados (BOE)', url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-5809' },
  { id: 'osm', title: 'OpenStreetMap contributors — container locations (ODbL)', url: 'https://www.openstreetmap.org/copyright' },
];

export function sourceById(id: string): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}
