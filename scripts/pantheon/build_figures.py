"""Builds the five Pantheon statues for Command's Living Pantheon.

    blender -b --factory-startup --python scripts/pantheon/build_figures.py -- [zeus athena ...]

Writes `public/pantheon/<id>.glb` and `public/pantheon/manifest.json`.

Each statue is static geometry in figure space (Y up, facing +Z, its left at
+X, about 1.86 units tall) around the shared skeleton in
`src/services/pantheonRig.json`. The app skins it to that skeleton when it
loads, so the clips in `pantheonClips.ts` drive every god. Object names carry
the binding, `label@Bone+Bone~p`:

- `label@A+B+C` is skinned across those bones by distance (falloff power p).
- `label@Bone` is rigid to one bone.
- `label@root` stays still on the platform.
- A label starting `Tool` or `Live` stays a separate node under its bone:
  `Tool` anchors effects and glances, `Live` parts are animated by the app.

Props are modelled where they sit in the god's hold pose and moved back to the
rest pose here, so the hold pose puts them back exactly.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RIG = json.load(open(os.path.join(ROOT, 'src', 'services', 'pantheonRig.json')))
OUT = os.path.join(ROOT, 'public', 'pantheon')
TAU = math.tau


# ---------------------------------------------------------------- rig maths

def rot(x=0., y=0., z=0.):
    if isinstance(x, np.ndarray): return x
    """three.js Euler 'XYZ' as a matrix (Rx @ Ry @ Rz)."""
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rx @ ry @ rz


def world_pose(hold):
    world = {}
    for name, parent, x, y, z in RIG['joints']:
        m = np.eye(4); m[:3, 3] = (x, y, z); m[:3, :3] = rot(*hold.get(name, (0, 0, 0)))
        world[name] = world[parent] @ m if parent else m
    return world


REST = world_pose({})
JOINT = {n: REST[n][:3, 3].copy() for n in REST}


class Pose:
    """The god's hold pose: where hands are, and the map from posed props back to rest."""

    def __init__(self, god):
        self.world = world_pose(RIG['hold'][god])

    def point(self, bone, local):
        return (self.world[bone] @ np.array([*local, 1.]))[:3]

    def axis(self, bone, local):
        return self.world[bone][:3, :3] @ np.array(local, float)

    def to_rest(self, bone):
        return REST[bone] @ np.linalg.inv(self.world[bone])


# ---------------------------------------------------------------- materials

def srgb(hexcolor):
    c = [((hexcolor >> s) & 255) / 255 for s in (16, 8, 0)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c]


def material(name, color, metallic=0., roughness=.5, emission=None, strength=0.):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*srgb(color), 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*srgb(emission), 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    m.use_backface_culling = False
    return m


def palette(accent, glow):
    return {
        'marble': material('marble', 0xcdbfa6, 0, .5),
        'stone': material('stone', 0xa89c88, 0, .55),
        'gold': material('gold', 0xe0ac55, 1, .3),
        'bronze': material('bronze', 0x8a5a30, 1, .42),
        'iron': material('iron', 0x45403b, .85, .45),
        'leather': material('leather', 0x5b3b25, .2, .62),
        'glow': material('glow', glow, 0, .4, glow, 4.),
        'accent': material('accent', accent, .3, .35, accent, 1.2),
    }


# ---------------------------------------------------------------- meshes

COUNT = [0]


def unique(label):
    COUNT[0] += 1
    return f'{label}{COUNT[0]}' if label[-1].isdigit() else f'{label}_{COUNT[0]}'


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def mesh(label, verts, faces, mat, binding, smooth=True, recalc=True):
    me = bpy.data.meshes.new(label)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if recalc: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    me.materials.append(mat)
    o = link(bpy.data.objects.new(f'{unique(label)}@{binding}', me))
    return o


def grid(rows, cols, wrap=True):
    faces = []
    for i in range(rows - 1):
        for j in range(cols if wrap else cols - 1):
            k = (j + 1) % cols
            faces.append((i * cols + j, i * cols + k, (i + 1) * cols + k, (i + 1) * cols + j))
    return faces


def cap(verts, faces, ring_start, cols, centre):
    c = len(verts); verts.append(centre)
    for j in range(cols):
        faces.append((ring_start + j, ring_start + (j + 1) % cols, c))


def ellipsoid(label, mat, c, r, binding, rotation=(0, 0, 0), seg=20, rings=12, part=None, smooth=True):
    """`part(x, y, z)` on the unit sphere keeps a face when true for all its corners."""
    R = rot(*rotation)
    verts, keep = [], []
    for i in range(rings + 1):
        phi = math.pi * i / rings
        for j in range(seg):
            th = TAU * j / seg
            u = np.array([math.sin(phi) * math.sin(th), math.cos(phi), math.sin(phi) * math.cos(th)])
            verts.append(np.array(c) + R @ (u * r)); keep.append(part(*u) if part else True)
    faces = [f for f in grid(rings + 1, seg) if all(keep[i] for i in f)]
    return mesh(label, verts, faces, mat, binding, smooth)


def tube(label, mat, pts, radii, binding, sides=12, outward=None, subdiv=6, ends=True, ripples=0, ripple=0., smooth=True, twist=0.):
    """A swept ellipse along a Catmull-Rom path. radii: per control point (w, h); h lies along `outward`."""
    P = [np.array(p, float) for p in pts]
    rad = [np.array(r if isinstance(r, (tuple, list)) else (r, r), float) for r in radii]
    path, rr = [], []
    n = len(P)
    for i in range(n - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, n - 1)]
        for s in range(subdiv if i < n - 2 else subdiv + 1):
            t = s / subdiv
            path.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
            rr.append(rad[i] * (1 - t) + rad[i + 1] * t)
    verts, faces = [], []
    N_prev = None
    for k, p in enumerate(path):
        T = path[min(k + 1, len(path) - 1)] - path[max(k - 1, 0)]; T /= np.linalg.norm(T)
        if outward is not None:
            N = np.array(outward(p), float)
        elif N_prev is None:
            N = np.cross(T, [0, 0, 1]) if abs(T[2]) < .9 else np.cross(T, [1, 0, 0])
        else:
            N = N_prev
        N = N - T * np.dot(N, T); N /= np.linalg.norm(N); N_prev = N
        B = np.cross(T, N)
        a0 = twist * k / max(len(path) - 1, 1)
        w, h = rr[k]
        for j in range(sides):
            a = TAU * j / sides + a0
            off = w * math.cos(a) * B + h * math.sin(a) * N
            if ripples: off += N * ripple * math.sin(ripples * math.pi * (math.cos(a) + 1) / 2)
            verts.append(p + off)
    faces = grid(len(path), sides)
    if ends:
        cap(verts, faces, 0, sides, path[0]); cap(verts, faces, (len(path) - 1) * sides, sides, path[-1])
    return mesh(label, verts, faces, mat, binding, smooth)


def cylinder(label, mat, a, b, r1, r2, binding, sides=16, smooth=True):
    a, b = np.array(a, float), np.array(b, float)
    T = (b - a) / np.linalg.norm(b - a)
    N = np.cross(T, [0, 0, 1]) if abs(T[2]) < .9 else np.cross(T, [1, 0, 0]); N /= np.linalg.norm(N); B = np.cross(T, N)
    verts, faces = [], []
    for p, r in ((a, r1), (b, r2)):
        for j in range(sides):
            ang = TAU * j / sides
            verts.append(p + r * (math.cos(ang) * N + math.sin(ang) * B))
    faces = grid(2, sides)
    cap(verts, faces, 0, sides, a); cap(verts, faces, sides, sides, b)
    o = mesh(label, verts, faces, mat, binding, smooth)
    if smooth: auto_smooth(o)
    return o


def box(label, mat, c, size, binding, rotation=(0, 0, 0), taper=(1, 1)):
    """Box centred at c; the top face is scaled by taper (x, z)."""
    R = rot(*rotation); sx, sy, sz = (s / 2 for s in size)
    verts = []
    for y in (-sy, sy):
        tx, tz = taper if y > 0 else (1, 1)
        for x, z in ((-sx, -sz), (sx, -sz), (sx, sz), (-sx, sz)):
            verts.append(np.array(c) + R @ np.array([x * tx, y, z * tz]))
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh(label, verts, faces, mat, binding, smooth=False)


def torus(label, mat, c, radii, tube_r, binding, rotation=(0, 0, 0), seg=48, sides=10, arc=TAU, wave=None):
    R = rot(*rotation)
    verts = []
    closed = arc >= TAU - 1e-6
    count = seg if closed else seg + 1
    for i in range(count):
        th = arc * i / seg
        centre = np.array([radii[0] * math.sin(th), 0, radii[1] * math.cos(th)])
        if wave: centre[1] += wave(th)
        out = np.array([math.sin(th), 0, math.cos(th)])
        for j in range(sides):
            a = TAU * j / sides
            verts.append(np.array(c) + R @ (centre + tube_r * (math.cos(a) * out + math.sin(a) * np.array([0, 1, 0]))))
    faces = grid(count, sides)
    if closed:
        faces += [((seg - 1) * sides + j, (seg - 1) * sides + (j + 1) % sides, (j + 1) % sides, j) for j in range(sides)]
    return mesh(label, verts, faces, mat, binding)


def robe(label, mat, binding, y0, y1, r0, r1, folds=16, amp=(.004, .018), seg=120, rows=26, flare=1.5,
         hem=.01, phase=0., z0=0., x0=0., lean=0., bulges=(), sector=None, lip=True, top_folds=1.):
    """A draped skirt: an elliptic lathe from y0 down to y1 with vertical folds deepening to the hem.
    bulges: (theta, y, amount, width) push the cloth out over a knee or hip. sector=(a, b) keeps an arc only."""
    a0, a1 = sector or (0, TAU)
    cols = seg if sector is None else seg + 1
    f2 = round(folds * 1.7)
    verts = []
    ring_rows = rows + (2 if lip else 0)
    for i in range(ring_rows):
        inner = lip and i >= rows
        t = min(i, rows - 1) / (rows - 1)
        y = y0 + (y1 - y0) * t + (.012 if inner and i == rows + 1 else 0) + (.004 if inner and i == rows else 0)
        e = t ** flare
        rx, rz = r0[0] + (r1[0] - r0[0]) * e, r0[1] + (r1[1] - r0[1]) * e
        a = amp[0] * top_folds + (amp[1] - amp[0] * top_folds) * t ** 1.2
        for j in range(cols):
            th = a0 + (a1 - a0) * j / (seg if sector is None else seg)
            fold = .62 * math.sin(folds * th + phase + 1.2 * t) + .38 * math.sin(f2 * th + 2.1 + 1.3 * phase - .8 * t)
            r_off = a * fold
            for bt, by, bamt, bw in bulges:
                d = math.atan2(math.sin(th - bt), math.cos(th - bt))
                r_off += bamt * math.exp(-(d / bw) ** 2) * math.exp(-((y - by) / .18) ** 2)
            scale = .955 if inner else 1.
            yy = y + (hem * math.sin(5 * th + phase) + hem * .7 * fold) * t ** 6
            verts.append(np.array([x0 + (rx + r_off) * math.sin(th) * scale, yy, z0 + lean * t + (rz + r_off) * math.cos(th) * scale]))
    return mesh(label, verts, grid(ring_rows, cols, wrap=sector is None), mat, binding)


def auto_smooth(o, angle=.6):
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    try:
        o.data.use_auto_smooth = True; o.data.auto_smooth_angle = angle
    except AttributeError:
        pass


# ---------------------------------------------------------------- sculpting by metaballs

def k_surface(stiffness, threshold=.6):
    return math.sqrt(1 - (threshold / stiffness) ** (1 / 3))


class Blob:
    """Soft sculpture: ellipsoids that melt into one surface; negative ones carve."""

    def __init__(self, label, resolution=.008):
        self.label = label
        self.mb = bpy.data.metaballs.new(label)
        self.mb.resolution = self.mb.render_resolution = resolution
        self.mb.threshold = .6

    def ell(self, c, r, rotation=(0, 0, 0), s=2., neg=False):
        e = self.mb.elements.new(type='ELLIPSOID')
        k = k_surface(s); m = max(r)
        e.co = tuple(map(float, c)); e.radius = m / k
        e.size_x, e.size_y, e.size_z = (float(v) / m for v in r)
        e.rotation = Matrix(rot(*rotation).tolist()).to_quaternion()
        e.stiffness = s; e.use_negative = neg
        return self

    def ball(self, c, r, s=2.):
        return self.ell(c, (r, r, r), s=s)

    def limb(self, a, b, ra, rb, n=None, s=2., flat=(1, 1)):
        a, b = np.array(a, float), np.array(b, float)
        n = n or max(3, int(np.linalg.norm(b - a) / (min(ra, rb) * .9)) + 1)
        for i in range(n):
            t = i / (n - 1); r = ra + (rb - ra) * t
            self.ell(a + (b - a) * t, (r * flat[0], r * 1.05, r * flat[1]), s=s)
        return self

    def build(self, mat, binding, tris=None):
        mbo = link(bpy.data.objects.new(self.label, self.mb))
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(mbo.evaluated_get(dg))
        bpy.data.objects.remove(mbo); bpy.data.metaballs.remove(self.mb)
        o = link(bpy.data.objects.new(f'{unique(self.label)}@{binding}', me))
        me.materials.clear(); me.materials.append(mat)
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        if tris and len(me.polygons) > tris:
            mod = o.modifiers.new('decimate', 'DECIMATE'); mod.ratio = tris / len(me.polygons)
            dg = bpy.context.evaluated_depsgraph_get()
            reduced = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            o.modifiers.clear(); o.data = reduced
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        return o


# ---------------------------------------------------------------- shared anatomy

# Bone groups from pantheonRig.json; names stay short (Blender caps them at 63 characters).
BODY, ROBE, SKIRT, CHEST = 'body', 'robe~2', 'skirt~3', 'chest~3'


def arm_binding(side):
    return f'arm{side[0]}'


def head(b, c=(0, 1.665, 0), female=False, beard=False):
    """Skull, face and features around the head centre c."""
    x, y, z = c
    f = .93 if female else 1.
    b.ell((x, y + .03 * f, z - .012), (.082 * f, .097 * f, .097 * f))           # cranium
    b.ell((x, y - .02 * f, z + .03), (.064 * f, .074 * f, .068 * f))           # face
    b.ell((x, y - .065 * f, z + .038), (.05 * f, .032 * f, .048 * f))          # jaw
    b.ell((x, y - .082 * f, z + .068 * f), (.022, .018, .018), s=3)            # chin
    b.ell((x, y + .0, z + .098 * f), (.012, .026, .017), rotation=(-.35, 0, 0), s=3)  # nose
    b.ell((x, y + .033 * f, z + .08 * f), (.058 * f, .013, .019), s=3)          # brow
    for s in (-1, 1):
        b.ell((x + s * .03 * f, y + .018 * f, z + .095 * f), (.017, .011, .02), neg=True, s=2.4)  # eye socket
        b.ell((x + s * .03 * f, y + .017 * f, z + .084 * f), (.012, .008, .01), s=3)            # eyeball
        b.ell((x + s * .04 * f, y + .0, z + .072 * f), (.021, .015, .017), s=3)              # cheekbone
        b.ell((x + s * .081 * f, y + .0, z - .004), (.011, .024, .016), s=3)                 # ear
    b.ell((x, y - .05 * f, z + .086 * f), (.022, .007, .01), s=3)                          # lips
    if female:
        b.ell((x, y - .055, z + .055), (.045, .03, .04), s=2)


def torso(b, sw=1., hw=1., ww=1., female=False, definition=0., chest_depth=1.):
    b.ell((0, .975, -.01), (.152 * hw, .1, .105))                       # pelvis
    b.ell((0, 1.06, .012), (.13 * ww * hw ** .5, .09, .095))            # lower abdomen
    b.ell((0, 1.14, .0), (.137 * ww, .08, .098 * chest_depth))          # waist
    b.ell((0, 1.265, -.005), (.163 * sw, .14, .112 * chest_depth))      # ribcage
    b.ell((0, 1.36, -.012), (.178 * sw, .075, .1 * chest_depth))        # upper chest
    b.ell((0, 1.445, -.035), (.115 * sw, .045, .052))                   # trapezius
    for s in (-1, 1):
        b.ell((s * .07 * hw, .93, -.07), (.078 * hw, .08, .07))           # glutes
        b.ell((s * .12 * sw, 1.25, -.04), (.06, .12, .06))                # lats
        b.ell((s * .1 * sw, 1.405, .02), (.05, .02, .03), rotation=(0, 0, s * -.25), s=3)  # clavicle
        if female:
            b.ell((s * .064, 1.295, .082), (.058, .056, .05), s=2.4)
        elif definition:
            b.ell((s * .078 * sw, 1.33, .072 * chest_depth), (.085 * sw, .058, .045), rotation=(0, 0, s * .22), s=2.4)
    if definition and not female:
        for row, yy in enumerate((1.07, 1.135, 1.2)):
            for s in (-1, 1):
                b.ell((s * .034, yy, .088 + .004 * row), (.03, .028, .02 * definition), s=3)
    b.limb((0, 1.43, -.005), (0, 1.6, .005), .052 if not female else .043, .048 if not female else .04)  # neck


def legs(b, hw=1., bulk=1., female=False):
    for s in (-1, 1):
        x = s * .1
        b.limb((s * .095 * hw, .92, 0), (x, .53, .01), .085 * bulk * hw ** .5, .055 * bulk)
        if not female:
            b.ell((x + s * .012, .74, .035), (.05 * bulk, .12, .05 * bulk), s=2.4)   # quadriceps
        b.ell((x, .5, .02), (.047, .05, .05))                                     # knee
        b.ell((x, .34, -.025), (.054 * bulk, .11, .056 * bulk))                   # calf
        b.limb((x, .46, .005), (x, .1, 0), .045, .032)                            # shin
        b.ell((x, .075, -.005), (.032, .03, .034))                                # ankle
        feet(b, s, x)


def feet(b, s, x):
    b.ell((x, .036, .05), (.042, .031, .095))
    b.ell((x, .04, -.025), (.033, .036, .035))
    b.ell((x + s * -.004, .024, .125), (.04, .02, .04), s=2.4)


def arm(b, s, sw=1., bulk=1., female=False):
    x = s * .205
    d = .82 if female else 1.
    b.ell((s * .2 * sw ** .5, 1.43, 0), (.07 * sw * d, .074 * d, .076 * d))                 # deltoid
    b.limb((x, 1.38, 0), (s * .2, 1.19, -.005), .057 * bulk * d, .045 * d)                # upper arm
    if not female:
        b.ell((s * .2, 1.31, .024), (.044 * bulk, .074, .044 * bulk), s=2.4)              # biceps
        b.ell((s * .206, 1.3, -.026), (.044 * bulk, .08, .044 * bulk), s=2.4)             # triceps
    b.ell((s * .2, 1.16, -.014), (.04 * d, .04, .04 * d))                                 # elbow
    b.limb((s * .2, 1.14, 0), (s * .2, .935, .004), .049 * bulk * d, .031 * d)            # forearm
    if not female:
        b.ell((s * .202, 1.08, .012), (.05 * bulk, .07, .046 * bulk), s=2.4)
    b.ell((s * .2, .915, .004), (.029 * d, .025, .033 * d))                               # wrist
    b.ell((s * .2, .852, .014), (.034 * d, .054 * d, .047 * d))                           # fist
    b.ell((s * .18, .872, .042), (.015, .03, .016), rotation=(.3, 0, 0), s=3)               # thumb


def curls(label, mat, binding, centre, radii, count, r, keep, jitter=.15, seed=1, resolution=.006, s=2., tris=2600, drop=None):
    """A mass of curls: small balls scattered over an ellipsoid shell where keep(u) holds."""
    rng = np.random.default_rng(seed)
    b = Blob(label, resolution)
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(count):
        yy = 1 - 2 * (i + .5) / count; rad = math.sqrt(1 - yy * yy); th = golden * i
        u = np.array([rad * math.sin(th), yy, rad * math.cos(th)])
        if not keep(u): continue
        p = np.array(centre) + u * np.array(radii) * (1 + rng.normal(0, jitter * .3))
        if drop: p = drop(p, u)
        b.ball(p, r * (1 + rng.normal(0, jitter)), s=s)
    return b.build(mat, binding, tris)


# ---------------------------------------------------------------- the gods

def hephaestus(m, pose):
    """The smith: broad, bare-chested, bearded; hammer, apron and anvil."""
    b = Blob('Body')
    torso(b, sw=1.1, hw=1.02, ww=.98, definition=1.)
    legs(b, bulk=1.05)
    head(b)
    b.build(m['marble'], BODY, tris=16000)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        a = Blob(f'Arm{side[0]}'); arm(a, s, sw=1.1, bulk=1.1); a.build(m['marble'], arm_binding(side), tris=3200)
        cylinder('Bracer', m['bronze'], (s * .2, .945, .004), (s * .2, 1.03, .006), .039, .046, f'{side}ForeArm')
    curls('Hair', m['marble'], 'Head', (0, 1.7, -.015), (.092, .1, .1), 150, .024,
          lambda u: u[1] > -.05 and (u[2] < .55 or u[1] > .55), seed=3)
    curls('Beard', m['marble'], 'Head', (0, 1.6, .03), (.07, .065, .07), 140, .02,
          lambda u: u[1] < .15 and u[2] > -.05 and not (u[1] > -.2 and abs(u[0]) < .3 and u[2] > .85),
          seed=5, drop=lambda p, u: p + np.array([0, -.02 * max(0, -u[1]), .01]))
    robe('Skirt', m['marble'], SKIRT, 1.03, .58, (.158, .124), (.205, .17), folds=13, amp=(.004, .016), flare=1.1, hem=.008)
    robe('Apron', m['leather'], SKIRT, 1.0, .52, (.172, .14), (.228, .192), folds=5, amp=(.002, .006), sector=(-.62, .62), lip=False, hem=0, seg=24)
    torus('Belt', m['gold'], (0, 1.02, 0), (.163, .128), .016, 'Hips')
    tube('Strap', m['marble'], [(-.12, 1.0, .12), (-.02, 1.18, .13), (.1, 1.36, .1), (.16, 1.47, .0), (.1, 1.36, -.115), (-.02, 1.18, -.13), (-.12, 1.0, -.12)],
         [(.036, .007)] * 7, CHEST, sides=10, outward=lambda p: (p[0] * .4, max(0, p[1] - 1.4) * 4, p[2]))
    # Hammer in the right fist: handle forward and down, the head's striking face down the swing.
    grip = np.array([0, -.06, .02]); d = np.array([0, -.565, .825]); e = np.array([0, .825, .565])
    hand = JOINT['RightHand']
    cylinder('Handle', m['leather'], hand + grip - d * .1, hand + grip + d * .33, .016, .019, 'RightHand', sides=10)
    head_c = hand + grip + d * .37
    box('Tool', m['iron'], head_c, (.075, .17, .075), 'RightHand', rotation=(math.atan2(e[2], e[1]), 0, 0))
    box('Hot', m['glow'], head_c - e * .0858, (.07, .003, .07), 'RightHand', rotation=(math.atan2(e[2], e[1]), 0, 0))
    # Anvil on the platform, under the strike.
    ax, az = -.2, .56
    box('AnvilFoot', m['bronze'], (ax, .05, az), (.26, .1, .17), 'root', taper=(.7, .7))
    box('AnvilWaist', m['iron'], (ax, .28, az), (.12, .36, .085), 'root', taper=(1.35, 1.2))
    box('AnvilFace', m['iron'], (ax, .5, az), (.34, .085, .14), 'root', taper=(1.02, 1.02))
    cylinder('AnvilHorn', m['iron'], (ax - .17, .505, az), (ax - .31, .52, az), .04, .006, 'root', sides=12)
    box('Work', m['glow'], (ax + .03, .552, az + .01), (.13, .02, .035), 'root')


def zeus(m, pose):
    """The king: robed below, bare right shoulder, full beard; a thunderbolt held high."""
    b = Blob('Body')
    torso(b, sw=1.06, hw=1.04, ww=1.06, definition=.8, chest_depth=1.05)
    for s in (-1, 1): feet(b, s, s * .1)
    head(b)
    b.build(m['marble'], BODY, tris=12000)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        a = Blob(f'Arm{side[0]}'); arm(a, s, sw=1.05, bulk=1.02); a.build(m['marble'], arm_binding(side), tris=3200)
    curls('Hair', m['marble'], 'Head', (0, 1.7, -.02), (.096, .104, .104), 170, .026,
          lambda u: u[1] > -.35 and (u[2] < .5 or u[1] > .6), seed=7,
          drop=lambda p, u: p + np.array([0, -.04 * max(0, -u[1] + .2) * (u[2] < 0), -.01 * (u[2] < 0)]))
    curls('Beard', m['marble'], 'Head', (0, 1.585, .035), (.074, .09, .074), 190, .022,
          lambda u: u[1] < .1 and u[2] > -.1 and not (u[1] > -.25 and abs(u[0]) < .3 and u[2] > .85),
          seed=9, drop=lambda p, u: p + np.array([0, -.05 * max(0, -u[1]), .015 * max(0, -u[1])]))
    torus('Fillet', m['gold'], (0, 1.735, -.01), (.094, .1), .008, 'Head', rotation=(-.18, 0, 0))
    robe('Himation', m['marble'], ROBE, 1.04, .03, (.16, .125), (.25, .205), folds=17, amp=(.003, .02), flare=1.35, hem=.012,
         bulges=((.15, .5, .03, .5),), phase=.4)
    torus('Roll', m['marble'], (0, 1.035, .0), (.168, .132), .022, 'Hips', rotation=(0, 0, .04),
          wave=lambda th: .012 * math.sin(7 * th))
    # The drape climbs the back to the left shoulder and falls across the chest to the right hip.
    tube('Drape', m['marble'], [(-.15, 1.0, -.1), (-.02, 1.2, -.13), (.1, 1.38, -.1), (.17, 1.47, -.01), (.13, 1.4, .1),
                                (.04, 1.26, .125), (-.08, 1.12, .135), (-.17, 1.03, .1)],
         [(.05, .016), (.075, .018), (.07, .02), (.06, .03), (.07, .022), (.08, .02), (.08, .02), (.06, .018)], CHEST,
         sides=16, outward=lambda p: (p[0] * .5, max(0, p[1] - 1.4) * 4, p[2]), ripples=3, ripple=.012)
    tube('Fall', m['marble'], [(.2, 1.4, -.05), (.24, 1.2, -.07), (.25, 1.0, -.06), (.24, .82, -.05)],
         [(.04, .014), (.05, .014), (.055, .014), (.045, .01)], 'Spine2+LeftShoulder+LeftArm~2', sides=14,
         outward=lambda p: (1, 0, -.4), ripples=3, ripple=.01)
    # Thunderbolt in the raised right fist, standing upright.
    fist = pose.point('RightHand', (0, -.06, .012))
    bolt = [(0, -.2, 0), (.02, -.08, .004), (-.035, .02, 0), (.02, .1, .004), (-.03, .22, 0), (.015, .34, .003), (-.01, .44, 0)]
    pts = [fist + np.array(p) for p in bolt]
    o = tube('Tool', m['glow'], pts, [.012, .02, .024, .022, .02, .014, .004], 'RightHand', sides=6, subdiv=2, smooth=False)
    pose_to_rest(o, pose, 'RightHand')
    for side in (-1, 1):
        prong = [fist + np.array(p) for p in [(0, -.08, 0), (side * .05, -.16, 0), (side * .03, -.24, 0)]]
        pose_to_rest(tube('Prong', m['glow'], prong, [.012, .01, .003], 'RightHand', sides=6, subdiv=2, smooth=False), pose, 'RightHand')
    # A small sphere of light over the open left hand.
    palm = pose.point('LeftHand', (0, -.06, .03))
    pose_to_rest(ellipsoid('Orb', m['glow'], palm + np.array([0, .07, .03]), (.03, .03, .03), 'LeftHand', seg=16, rings=10), pose, 'LeftHand')


def athena(m, pose):
    """Wisdom in armour: crested helm tipped back, aegis, spear and round shield."""
    b = Blob('Body')
    torso(b, sw=.84, hw=1.12, ww=.8, female=True)
    for s in (-1, 1): feet(b, s, s * .095)
    head(b, female=True)
    b.build(m['marble'], BODY, tris=11000)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        a = Blob(f'Arm{side[0]}'); arm(a, s, sw=.86, bulk=.9, female=True); a.build(m['marble'], arm_binding(side), tris=2600)
    curls('Hair', m['marble'], 'Head', (0, 1.66, -.035), (.088, .105, .09), 120, .024,
          lambda u: u[2] < .2 and u[1] < .5, seed=11,
          drop=lambda p, u: p + np.array([0, -.06 * max(0, -u[2]), -.01]))
    robe('Peplos', m['marble'], ROBE, 1.02, .03, (.15, .118), (.24, .19), folds=21, amp=(.003, .016), flare=1.3, hem=.01, phase=1.1,
         bulges=((-.2, .5, .025, .5),))
    robe('Overfold', m['marble'], SKIRT, 1.14, .84, (.152, .12), (.21, .165), folds=15, amp=(.004, .014), flare=1.1, hem=.014, phase=2.)
    torus('Girdle', m['gold'], (0, 1.13, .004), (.147, .116), .012, 'Spine')
    ellipsoid('Aegis', m['gold'], (0, 1.29, .008), (.172, .15, .135), CHEST, part=lambda x, y, z: z > .12 and y > -.7)
    ellipsoid('Gorgon', m['accent'], (0, 1.33, .112), (.028, .028, .012), 'Spine2', seg=14, rings=8)
    # Corinthian helm worn pushed up, with a tall crest from brow to nape.
    hc = np.array([0, 1.735, -.012])
    ellipsoid('Helm', m['gold'], hc + np.array([0, -.01, -.005]), (.1, .09, .112), 'Head', rotation=(-.25, 0, 0), part=lambda x, y, z: y > -.3)
    ellipsoid('Visor', m['gold'], hc + np.array([0, .03, .085]), (.07, .03, .035), 'Head', rotation=(-.6, 0, 0))
    crest = [hc + np.array([0, .115 * math.sin(a), .125 * math.cos(a)]) for a in np.linspace(.45, 2.9, 7)]
    tube('Crest', m['bronze'], crest, [(.01, .02), (.012, .032), (.013, .038), (.013, .04), (.012, .036), (.011, .03), (.008, .02)], 'Head',
         sides=10, outward=lambda p: (0, p[1] - hc[1], p[2] - hc[2]))
    # Spear upright through the right fist.
    fist = pose.point('RightHand', (0, -.06, .012))
    foot, top = np.array([fist[0], .03, fist[2]]), np.array([fist[0], 2.05, fist[2]])
    pose_to_rest(cylinder('Shaft', m['bronze'], foot, top, .011, .011, 'RightHand', sides=10), pose, 'RightHand')
    blade = [top + np.array([0, h, 0]) for h in (0, .04, .12, .2)]
    pose_to_rest(tube('Tool', m['accent'], blade, [(.014, .006), (.032, .008), (.02, .005), (.001, .001)], 'RightHand', sides=8, smooth=False,
                      outward=lambda p: (0, 0, 1)), pose, 'RightHand')
    # Round shield on the left forearm, face turned out and forward.
    fore = pose.point('LeftForeArm', (0, -.15, 0))
    normal = np.array([.55, 0, .84]); normal /= np.linalg.norm(normal)
    centre = fore + normal * .05
    ry = math.atan2(normal[0], normal[2])
    pose_to_rest(ellipsoid('Shield', m['marble'], centre, (.25, .25, .045), 'LeftForeArm', rotation=(0, ry, 0), seg=40, rings=10,
                           part=lambda x, y, z: z > -.2), pose, 'LeftForeArm')
    pose_to_rest(torus('Rim', m['gold'], centre - normal * .006, (.25, .25), .016, 'LeftForeArm', rotation=rot(0, ry, 0) @ rot(math.pi / 2), seg=64, sides=8), pose, 'LeftForeArm')
    rim2 = torus('Ring', m['gold'], centre + normal * .03, (.15, .15), .008, 'LeftForeArm', rotation=rot(0, ry, 0) @ rot(math.pi / 2), seg=48, sides=6)
    pose_to_rest(rim2, pose, 'LeftForeArm')
    pose_to_rest(ellipsoid('Owl', m['accent'], centre + normal * .042, (.05, .05, .018), 'LeftForeArm', rotation=(0, ry, 0), seg=18, rings=8), pose, 'LeftForeArm')


def dionysus(m, pose):
    """The reveller: youthful, long-haired, vine-crowned; a cup raised in the left hand."""
    b = Blob('Body')
    torso(b, sw=.96, hw=1.04, ww=.9, definition=.35)
    for s in (-1, 1): feet(b, s, s * .1)
    head(b)
    b.build(m['marble'], BODY, tris=11000)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        a = Blob(f'Arm{side[0]}'); arm(a, s, sw=.95, bulk=.92); a.build(m['marble'], arm_binding(side), tris=2800)
    curls('Hair', m['marble'], 'Head', (0, 1.69, -.02), (.094, .102, .1), 170, .026,
          lambda u: u[1] > -.55 and (u[2] < .45 or u[1] > .55), seed=13,
          drop=lambda p, u: p + np.array([0, -.08 * max(0, -u[1] + .1) * (u[2] < .2), -.012 * (u[2] < 0)]))
    # Vine crown: a gold band with leaves and grapes.
    crown_c = np.array([0, 1.74, -.012])
    torus('Vine', m['gold'], crown_c, (.1, .106), .006, 'Head', rotation=(-.15, 0, 0), wave=lambda th: .006 * math.sin(9 * th))
    for i in range(14):
        th = TAU * i / 14
        p = crown_c + rot(-.15) @ np.array([.104 * math.sin(th), .012 * math.sin(3 * th), .11 * math.cos(th)])
        ellipsoid('Leaf', m['gold'], p, (.026, .006, .018), 'Head', rotation=(.5, th, 0), seg=10, rings=6)
    for i, (dx, dy) in enumerate([(0, 0), (.012, -.018), (-.012, -.018), (0, -.034), (.022, -.004), (-.022, -.004)]):
        for s in (-1, 1):
            ellipsoid('Grape', m['accent'], (s * (.09 + dx * .5), 1.7 + dy, .05 + dx * .3), (.011, .011, .011), 'Head', seg=8, rings=6)
    robe('Chiton', m['marble'], ROBE, 1.04, .03, (.152, .12), (.235, .19), folds=19, amp=(.003, .018), flare=1.4, hem=.012, phase=2.6,
         bulges=((.25, .5, .03, .5),))
    torus('Sash', m['gold'], (0, 1.04, .0), (.155, .122), .011, 'Hips')
    tube('Nebris', m['marble'], [(.14, 1.0, -.12), (.17, 1.2, -.11), (.16, 1.46, -.02), (.08, 1.37, .11), (-.04, 1.21, .13), (-.15, 1.06, .11)],
         [(.05, .015), (.07, .018), (.06, .03), (.075, .02), (.08, .02), (.06, .018)], CHEST, sides=16,
         outward=lambda p: (p[0] * .5, max(0, p[1] - 1.4) * 4, p[2]), ripples=3, ripple=.012)
    # Kantharos raised in the left hand: bowl, two high handles, stem and foot.
    fist = pose.point('LeftHand', (0, -.06, .012))
    up = np.array([0, 1., 0]); base = fist + np.array([0, .045, 0])
    parts = [
        ellipsoid('Tool', m['gold'], base + up * .085, (.055, .045, .055), 'LeftHand', part=lambda x, y, z: y < .45, seg=24, rings=12),
        ellipsoid('Wine', m['glow'], base + up * .1, (.046, .004, .046), 'LeftHand', seg=20, rings=6),
        cylinder('Stem', m['gold'], base, base + up * .05, .012, .01, 'LeftHand', sides=10),
        ellipsoid('CupFoot', m['gold'], base - up * .005, (.035, .008, .035), 'LeftHand', seg=16, rings=6),
    ]
    for s in (-1, 1):
        h = [base + np.array([s * .05, .1, 0]), base + np.array([s * .085, .14, 0]), base + np.array([s * .08, .07, 0]), base + np.array([s * .04, .055, 0])]
        parts.append(tube('Handle', m['gold'], h, [.005] * 4, 'LeftHand', sides=6))
    for o in parts: pose_to_rest(o, pose, 'LeftHand')
    # Thyrsus held loosely in the right hand: a fennel staff crowned with a pine cone.
    fist = pose.point('RightHand', (0, -.06, .012))
    foot, top = np.array([fist[0] - .02, .03, fist[2] + .02]), np.array([fist[0] + .015, 1.62, fist[2] - .01])
    pose_to_rest(cylinder('Thyrsus', m['gold'], foot, top, .009, .011, 'RightHand', sides=8), pose, 'RightHand')
    pose_to_rest(ellipsoid('Cone', m['accent'], top + np.array([0, .045, 0]), (.024, .05, .024), 'RightHand', seg=12, rings=8), pose, 'RightHand')


def themis(m, pose):
    """Order and law: a long chiton, a diadem; scales held out, a scroll at her side."""
    b = Blob('Body')
    torso(b, sw=.82, hw=1.1, ww=.8, female=True)
    for s in (-1, 1): feet(b, s, s * .095)
    head(b, female=True)
    b.build(m['marble'], BODY, tris=11000)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        a = Blob(f'Arm{side[0]}'); arm(a, s, sw=.84, bulk=.88, female=True); a.build(m['marble'], arm_binding(side), tris=2600)
    curls('Hair', m['marble'], 'Head', (0, 1.68, -.02), (.088, .096, .094), 130, .022,
          lambda u: u[1] > -.4 and (u[2] < .3 or u[1] > .62), seed=17)
    ellipsoid('Bun', m['marble'], (0, 1.68, -.115), (.05, .045, .04), 'Head', seg=16, rings=10)
    torus('Diadem', m['gold'], (0, 1.725, -.004), (.094, .088), .007, 'Head', rotation=(-.3, -math.pi / 2, 0), arc=math.pi, seg=24)
    ellipsoid('Jewel', m['accent'], (0, 1.79, .07), (.012, .016, .008), 'Head', seg=10, rings=6)
    robe('Chiton', m['marble'], ROBE, 1.2, .03, (.135, .108), (.235, .19), folds=24, amp=(.002, .014), flare=1.25, hem=.008, phase=.9,
         bulges=((.3, .5, .02, .5), (-.15, 1.15, .015, .6)), top_folds=.5)
    torus('Band', m['gold'], (0, 1.205, .004), (.137, .112), .009, 'Spine1')
    for s in (-1, 1):
        ellipsoid('Clasp', m['gold'], (s * .13, 1.455, .02), (.014, .014, .01), 'Spine2', seg=10, rings=6)
        tube('Fold', m['marble'], [(s * .12, 1.44, .04), (s * .09, 1.36, .095), (s * .07, 1.26, .11), (s * .055, 1.21, .115)],
             [.007, .008, .008, .006], CHEST, sides=8)
    tube('Mantle', m['marble'], [(.11, 1.06, -.1), (.16, 1.2, -.1), (.15, 1.45, -.03), (.06, 1.36, .1), (-.06, 1.22, .12), (-.16, 1.1, .09)],
         [(.02, .01), (.065, .018), (.06, .028), (.075, .02), (.075, .02), (.05, .018)], CHEST, sides=16,
         outward=lambda p: (p[0] * .5, max(0, p[1] - 1.4) * 4, p[2]), ripples=3, ripple=.01)
    # Scales hanging from the raised right hand; the beam and pans are animated parts.
    fist = pose.point('RightHand', (0, -.06, .012))
    pose_to_rest(torus('Tool', m['gold'], fist + np.array([0, .045, 0]), (.022, .022), .005, 'RightHand', rotation=(math.pi / 2, 0, 0), seg=16, sides=6), pose, 'RightHand')
    pivot = fist + np.array([0, -.11, 0])
    rod = cylinder('Rod', m['gold'], fist + np.array([0, .02, 0]), pivot, .005, .005, 'RightHand', sides=6)
    beam = cylinder('LiveBeam', m['gold'], pivot - np.array([.16, 0, 0]), pivot + np.array([.16, 0, 0]), .009, .009, 'RightHand', sides=8)
    for s in (-1, 1): join(beam, ellipsoid('Knob', m['gold'], pivot + np.array([s * .162, 0, 0]), (.013, .013, .013), 'RightHand', seg=10, rings=6))
    join(beam, ellipsoid('Pivot', m['gold'], pivot, (.016, .022, .016), 'RightHand', seg=10, rings=6))
    set_origin(beam, pivot)
    pans = []
    for s, name in ((-1, 'LivePanR'), (1, 'LivePanL')):
        end = pivot + np.array([s * .155, 0, 0])
        pan = ellipsoid(name, m['gold'], end + np.array([0, -.14, 0]), (.062, .016, .062), 'RightHand', seg=20, rings=8, part=lambda x, y, z: y < .3)
        for a in range(3):
            th = TAU * a / 3
            rim = end + np.array([.052 * math.sin(th), -.13, .052 * math.cos(th)])
            chain = cylinder('Chain', m['gold'], end, rim, .0012, .0012, 'RightHand', sides=4, smooth=False)
            join(pan, chain)
        set_origin(pan, end)
        pans.append(pan)
    for pan in pans: parent(pan, beam)
    pose_to_rest(rod, pose, 'RightHand'); pose_to_rest(beam, pose, 'RightHand')
    # A scroll held across the left fist.
    fist = pose.point('LeftHand', (0, -.06, .012))
    axis = pose.axis('LeftHand', (0, 0, 1))
    pose_to_rest(cylinder('Scroll', m['stone'], fist - axis * .11, fist + axis * .11, .024, .024, 'LeftHand', sides=16), pose, 'LeftHand')
    for s in (-1, 1):
        pose_to_rest(cylinder('Knob', m['gold'], fist + axis * s * .11, fist + axis * s * .13, .01, .006, 'LeftHand', sides=8), pose, 'LeftHand')


# ---------------------------------------------------------------- object helpers

def pose_to_rest(o, pose, bone):
    bpy.context.view_layer.update()
    o.matrix_world = Matrix(pose.to_rest(bone).tolist()) @ o.matrix_world
    bpy.context.view_layer.update()
    return o


def set_origin(o, point):
    p = np.array(point, float)
    for v in o.data.vertices: v.co = tuple(np.array(v.co) - p)
    o.location = tuple(p)
    bpy.context.view_layer.update()


def centre_origin(o):
    vs = np.array([v.co[:] for v in o.data.vertices])
    c = (vs.min(0) + vs.max(0)) / 2
    for v in o.data.vertices: v.co = tuple(np.array(v.co) - c)
    o.matrix_world = o.matrix_world @ Matrix.Translation(c.tolist())


def join(target, other):
    bm = bmesh.new(); bm.from_mesh(target.data); bm.from_mesh(other.data); bm.to_mesh(target.data); bm.free()
    bpy.data.objects.remove(other)


def parent(child, father):
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = father
    child.matrix_parent_inverse = Matrix.Identity(4)
    child.matrix_basis = father.matrix_world.inverted() @ world


# ---------------------------------------------------------------- build

GODS = {
    'zeus': (zeus, 0xf2c46b, 0xffd27a),
    'athena': (athena, 0x7fd3e6, 0x9fe8ff),
    'hephaestus': (hephaestus, 0xff9a4a, 0xff7a2a),
    'dionysus': (dionysus, 0xb98ae8, 0xb06cf0),
    'themis': (themis, 0xf3ead2, 0xfff1cf),
}


def build(god):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    COUNT[0] = 0
    builder, accent, glow = GODS[god]
    builder(palette(accent, glow), Pose(god))
    bpy.context.view_layer.update()
    # A tool's origin is where effects start and eyes go: the middle of the tool, not the figure's feet.
    for o in bpy.context.scene.objects:
        if o.name.startswith('Tool'):
            centre_origin(o)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
    path = os.path.join(OUT, f'{god}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=False, export_apply=True,
                              export_animations=False, export_skins=False, export_texcoords=False,
                              export_normals=True, export_extras=False, export_lights=False, export_cameras=False)
    print(f'[pantheon] {god}: {len(bpy.context.scene.objects)} parts, {tris} triangles, {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for god in argv or list(GODS):
        build(god)
    manifest = {god: f'{god}.glb' for god in GODS if os.path.exists(os.path.join(OUT, f'{god}.glb'))}
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2); f.write('\n')
