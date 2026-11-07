// white-model/catalog/objects/revit-family.js
// Builds a catalog object from a REAL Revit family, tessellated out of its .rfa through the Revit
// MCP inside a transaction that was rolled back - the .rvt was never modified.
//
// ⭐ ONE BUILDER FOR EVERY EXTRACTED FAMILY. A second manufacturer chair is a JSON file and one
//    line in objects.json, never another builder. (.claude/rules/studio-architecture.md)
//
// The JSON holds one group per Revit material: {material, colour, pos[]} with pos already in
// viewer axes and metres. ⛔ The axis map was applied at extraction, not here - world X stays
// Revit X, and only Y/Z swap (Revit is Z-up, the viewer Y-up). Doing it twice would mirror the
// chair and nobody would notice until it reached Revit.
//
// Origin is at floor-centre in X/Z with the floor at y=0, matching every other catalog object.

window.WMOBJ_revitFamily = function (THREE, geo) {
  var g = new THREE.Group();
  if (!geo || !geo.groups) { console.error('[revit-family] no geometry'); return g; }

  var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  geo.groups.forEach(function (grp) {
    for (var i = 0; i < grp.pos.length; i += 3) {
      for (var a = 0; a < 3; a++) {
        var v = grp.pos[i + a];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }
  });
  var cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, floor = min[1];

  geo.groups.forEach(function (grp) {
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(grp.pos.slice(), 3));
    /* ⛔⛔ EVERY OBJECT STANDS ON THE FLOOR (Omer, 2026-08-23, placing the wall cabinet: "its
       floating on air and not stick to the floor" - and he is right).
       I had the loader lift a wall-based family by its `elevation_m` so it would hang at cabinet
       height. But the placement follows the FLOOR, not a wall: with nothing behind it to hang on,
       a 1.45 m lift is not "mounted", it is floating in the middle of the room.
       ⛔ The data stays - `mount: "wall"` and `elevation_m` are true of the family and the
       write-back will want them - but the VIEWER ignores them until wall SNAPPING exists (pick the
       wall, hang it on that wall's face at that height). Hanging is a headset behaviour and comes
       on its own, with his eye on it. */
    bg.translate(-cx, -floor, -cz);              // stand it on the floor, centred
    bg.computeVertexNormals();
    var m = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({
      color: new THREE.Color(grp.colour || '#b0b0b0'), roughness: 0.72, metalness: 0.0,
    }));
    m.userData.revitMaterial = grp.material;     // survives into paint / write-back
    g.add(m);
  });
  g.userData.revitFamily = geo.source;
  g.userData.revitType = geo.type;
  if (geo.mount) g.userData.mount = geo.mount;
  return g;
};
