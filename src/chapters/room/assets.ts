/** Optimised CC0 assets from Poly Haven (see assets/ASSET_REGISTER.md, A010–A019). */
export const ROOM_MODELS = {
  desk: '/assets/models/metal_office_desk.glb',
  chair: '/assets/models/modern_arm_chair_01.glb',
  lamp: '/assets/models/desk_lamp_arm_01.glb',
  plant: '/assets/models/potted_plant_04.glb',
  notepads: '/assets/models/office_notepads.glb',
  shelf: '/assets/models/Shelf_01.glb',
  ceilingLamp: '/assets/models/modern_ceiling_lamp_01.glb',
} as const;

export const PANEL_TEXTURES = {
  map: '/assets/textures/metal_plate_diffuse.ktx2',
  normalMap: '/assets/textures/metal_plate_nor_gl.ktx2',
  arm: '/assets/textures/metal_plate_arm.ktx2',
} as const;

export const FLOOR_TEXTURES = {
  map: '/assets/textures/concrete_floor_painted_diffuse.ktx2',
  normalMap: '/assets/textures/concrete_floor_painted_nor_gl.ktx2',
  arm: '/assets/textures/concrete_floor_painted_arm.ktx2',
} as const;

export const ROOM_HDRI = '/assets/env/empty_warehouse_01_1k.hdr';
