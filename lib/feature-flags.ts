// Single switch for the event stage.
//
//   SHOW_3D_BODY = false -> two-photo stage with hotspot overlays (publish cut)
//   SHOW_3D_BODY = true  -> the existing 3D cage, exactly as it was
//
// Nothing 3D was deleted to make the photo stage work. EventCage, BodyCanvas,
// cage-stickers, zone-views, the GLBs, three and @google/model-viewer are all
// still in the repo. Flip this one constant to get the 3D stage back.
export const SHOW_3D_BODY = false;
