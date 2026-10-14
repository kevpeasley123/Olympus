import type { FigureId } from './pantheonFigureState';

/**
 * Material presets for the Pantheon statues. A skin changes colours,
 * reflections, rim light, weathering and the light around each god; the
 * models, clips, stations and interactions are shared by every skin.
 *
 * Slots are the material names `scripts/pantheon/build_figures.py` writes:
 * `marble` is the figure itself (body, hair), `cloth` its garments, the rest
 * trims and props. `glow` and `accent` keep each god's own colour unless a
 * skin overrides it, and only their emissive strength scales.
 */
export type SkinId = 'aged-bronze' | 'obsidian-gold' | 'mythic' | 'celestial';
export type Slot = 'marble' | 'cloth' | 'stone' | 'gold' | 'bronze' | 'iron' | 'leather' | 'accent' | 'glow';
export interface Finish {
  color?: number; metalness: number; roughness: number;
  /** Environment reflection strength. */ env: number;
  /** Rim light strength; the colour is the skin's or the god's. */ rim: number;
  /** Surface weathering, 0 smooth to about .3 heavily worn. */ grain: number;
  /** Emissive multiplier for parts that glow on their own. */ emissive?: number;
  /** A window into the night sky: deep translucent blue with stars, 0 to 1. */ celestial?: number;
}
export interface Lighting {
  /** Opacity of the soft shadow behind the figure. */ backShadow: number;
  /** Platform glow, as a share of the state's glow. */ pedestal: number;
  /** The god's coloured fill light, as a share. */ fill: number;
  /** Baked ambient occlusion strength. */ ao: number;
  /** Sculptural form shading: soft falloff away from the key light and toward the feet. */ form: number;
}
interface GodTint { rimColor?: number; slots?: Partial<Record<Slot, Partial<Finish>>> }
export interface Skin { id: SkinId; name: string; rimColor: number; slots: Record<Slot, Finish>; lighting: Lighting; gods?: Partial<Record<FigureId, GodTint>> }

export const SKINS: readonly Skin[] = [
  {
    id: 'aged-bronze', name: 'Aged Bronze', rimColor: 0xf0a85a,
    slots: {
      marble: { color: 0x8c6644, metalness: .74, roughness: .46, env: .5, rim: .32, grain: .2 },
      cloth: { color: 0xeae5da, metalness: 0, roughness: .62, env: .22, rim: .14, grain: .08 },
      stone: { color: 0x5f5548, metalness: 0, roughness: .8, env: .18, rim: .2, grain: .24 },
      gold: { color: 0x9a7638, metalness: 1, roughness: .42, env: .55, rim: .26, grain: .12 },
      bronze: { color: 0x45301f, metalness: .9, roughness: .5, env: .55, rim: .26, grain: .2 },
      iron: { color: 0x2c2926, metalness: .85, roughness: .5, env: .55, rim: .2, grain: .18 },
      leather: { color: 0x3b281b, metalness: .1, roughness: .7, env: .25, rim: .16, grain: .2 },
      accent: { metalness: .3, roughness: .4, env: .4, rim: .2, grain: 0, emissive: .4 },
      glow: { metalness: 0, roughness: .4, env: 0, rim: 0, grain: 0, emissive: .35 },
    },
    lighting: { backShadow: .5, pedestal: .62, fill: .45, ao: 1, form: .55 },
  },
  {
    id: 'obsidian-gold', name: 'Obsidian Gold', rimColor: 0xe0b060,
    slots: {
      marble: { color: 0x1a181c, metalness: .25, roughness: .3, env: .9, rim: .42, grain: .1 },
      cloth: { color: 0x2b282a, metalness: .05, roughness: .62, env: .35, rim: .3, grain: .16 },
      stone: { color: 0x302c2b, metalness: 0, roughness: .6, env: .35, rim: .28, grain: .16 },
      gold: { color: 0xcf9d4b, metalness: 1, roughness: .28, env: 1, rim: .3, grain: .06 },
      bronze: { color: 0x2e2722, metalness: .8, roughness: .38, env: .8, rim: .32, grain: .1 },
      iron: { color: 0x1c1b1d, metalness: .8, roughness: .42, env: .7, rim: .28, grain: .1 },
      leather: { color: 0x221b17, metalness: .1, roughness: .6, env: .3, rim: .24, grain: .14 },
      accent: { color: 0xc9a253, metalness: .6, roughness: .3, env: .6, rim: .2, grain: 0, emissive: .35 },
      glow: { metalness: 0, roughness: .4, env: 0, rim: 0, grain: 0, emissive: .35 },
    },
    lighting: { backShadow: .42, pedestal: .55, fill: .4, ao: .75, form: .35 },
  },
  {
    id: 'mythic', name: 'Mythic Color', rimColor: 0xe6b067,
    slots: {
      marble: { color: 0x584029, metalness: .78, roughness: .5, env: .45, rim: .32, grain: .22 },
      cloth: { color: 0x655949, metalness: .05, roughness: .76, env: .2, rim: .22, grain: .22 },
      stone: { color: 0x7a664c, metalness: 0, roughness: .76, env: .2, rim: .2, grain: .22 },
      gold: { color: 0x9e7a3c, metalness: 1, roughness: .4, env: .58, rim: .26, grain: .1 },
      bronze: { color: 0x47301f, metalness: .88, roughness: .48, env: .58, rim: .26, grain: .18 },
      iron: { color: 0x2b2826, metalness: .85, roughness: .5, env: .55, rim: .2, grain: .16 },
      leather: { color: 0x3a2617, metalness: .1, roughness: .7, env: .25, rim: .16, grain: .2 },
      accent: { metalness: .3, roughness: .4, env: .4, rim: .2, grain: 0, emissive: .5 },
      glow: { metalness: 0, roughness: .4, env: 0, rim: 0, grain: 0, emissive: .45 },
    },
    lighting: { backShadow: .48, pedestal: .7, fill: .7, ao: .9, form: .45 },
    gods: {
      zeus: { rimColor: 0xffc067, slots: { marble: { color: 0x3a3734, metalness: .35, roughness: .48, env: .5 }, cloth: { color: 0x5c4c32, metalness: .45, roughness: .55, env: .4 }, gold: { color: 0xb08a4a }, glow: { emissive: .5 } } },
      athena: { rimColor: 0x8fd0e0, slots: { marble: { color: 0x6b5038 }, cloth: { color: 0x3c4958, metalness: .5, roughness: .5, env: .45 }, gold: { color: 0x9d8a6a, metalness: .9 }, bronze: { color: 0x5a3e27 }, accent: { color: 0x5fb3c4, emissive: .55 } } },
      hephaestus: { rimColor: 0xff9a52, slots: { marble: { color: 0x5c3920, metalness: .85, roughness: .52, env: .38 }, cloth: { color: 0x37322d, metalness: .5, roughness: .58, env: .45 }, iron: { color: 0x2a2624 }, glow: { emissive: .7 } } },
      dionysus: { rimColor: 0xc39ae6, slots: { marble: { color: 0x6c4a33 }, cloth: { color: 0x3d2340, metalness: .1, roughness: .55, env: .35 }, accent: { color: 0x8a66b4, emissive: .5 }, glow: { emissive: .5 } } },
      themis: { rimColor: 0xf2c56c, slots: { marble: { color: 0x958871, metalness: 0, roughness: .58, env: .26 }, cloth: { color: 0x84694a, metalness: 0, roughness: .76, env: .2 }, gold: { color: 0xb68b45 }, stone: { color: 0x9f8562 } } },
    },
  },
  {
    id: 'celestial', name: 'Celestial', rimColor: 0x9cc8ff,
    slots: {
      marble: { color: 0x0d1a3a, metalness: .1, roughness: .4, env: .22, rim: .3, grain: 0, celestial: 1 },
      cloth: { color: 0xeae5da, metalness: 0, roughness: .62, env: .22, rim: .16, grain: .06 },
      stone: { color: 0xd8d2c4, metalness: 0, roughness: .66, env: .2, rim: .16, grain: .08 },
      gold: { color: 0xd2b77a, metalness: 1, roughness: .3, env: .75, rim: .24, grain: .04 },
      bronze: { color: 0x7d8aa6, metalness: .85, roughness: .34, env: .7, rim: .3, grain: .06 },
      iron: { color: 0x3a4152, metalness: .85, roughness: .4, env: .6, rim: .26, grain: .06 },
      leather: { color: 0x4a3b30, metalness: .1, roughness: .64, env: .25, rim: .18, grain: .1 },
      accent: { metalness: .3, roughness: .35, env: .45, rim: .2, grain: 0, emissive: .5 },
      glow: { metalness: 0, roughness: .4, env: 0, rim: 0, grain: 0, emissive: .45 },
    },
    lighting: { backShadow: .4, pedestal: .62, fill: .3, ao: .9, form: .5 },
  },
];

export const DEFAULT_SKIN: SkinId = 'aged-bronze';
const byId = new Map(SKINS.map(s => [s.id, s]));
export const skinById = (id: SkinId) => byId.get(id) ?? byId.get(DEFAULT_SKIN)!;

/** The finish a slot takes on a god under a skin; null for a material the skins don't know. */
export function finishFor(skin: Skin, god: FigureId, slot: string): Finish | null {
  const base = skin.slots[slot as Slot];
  if (!base) return null;
  return { ...base, ...skin.gods?.[god]?.slots?.[slot as Slot] };
}
export const rimColorFor = (skin: Skin, god: FigureId) => skin.gods?.[god]?.rimColor ?? skin.rimColor;

// The comparison picker is for evaluation only: production builds always use the default skin.
export const SKIN_PICKER = import.meta.env.DEV || import.meta.env.VITE_PANTHEON_SKIN_PICKER === '1';
const STORAGE_KEY = 'olympus.pantheonSkin';
let current: SkinId = DEFAULT_SKIN;
if (SKIN_PICKER) try { const stored = localStorage.getItem(STORAGE_KEY); if (stored && byId.has(stored as SkinId)) current = stored as SkinId; } catch { /* storage unavailable */ }
const listeners = new Set<() => void>();
export const pantheonSkin = () => current;
export function setPantheonSkin(id: SkinId) {
  if (!byId.has(id) || id === current) return;
  current = id;
  if (SKIN_PICKER) try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
  listeners.forEach(f => f());
}
export function subscribePantheonSkin(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
