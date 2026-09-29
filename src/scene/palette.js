/**
 * Palette — warm neutrals only, one accent.
 *
 * Derived from an analysis of Anthropic's model-launch pages, which use a
 * 22-step warm slate ramp (`#faf9f5` cream → `#141413` ink) with a single
 * accent, clay `#d97757`. Every neutral there is tinted yellow-red; there is
 * no cold grey anywhere in the system, and pure `#000` is effectively unused.
 *
 * The three "nature" colours (sky/olive/cactus) are lifted from their
 * data-visualisation palette. That is where they are permitted here too: the
 * 3D node graph is data visualisation, not chrome.
 */

export const HEX = {
  // dark chapter — the hero
  ink: '#0D0C0B',
  ink2: '#141413',
  ink3: '#1F1E1D',

  // light chapter — the whole document body
  ivory: '#FAF9F5',
  ivory2: '#F0EEE6',
  ivory3: '#E8E6DC',

  // ink for the light chapter
  slate: '#141413',
  slate2: '#3D3D3A',
  stone: '#87867F',
  stone2: '#B0AEA5',

  // hero text
  cream: '#F2EDE4',
  cream2: '#DEDCD1',

  // the one accent
  clay: '#D97757',
  clayDeep: '#C96442',

  // data-visualisation only (node kinds)
  sage: '#9DBFAE',
  sky: '#6A9BCC',
};

/** Numeric form for THREE.Color and shader uniforms. */
export const RGB = Object.fromEntries(
  Object.entries(HEX).map(([key, hex]) => {
    const value = parseInt(hex.slice(1), 16);
    return [key, [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]];
  }),
);

export const toThree = (THREE, hex) => new THREE.Color(hex);
