"""Second batch of dog clips: rest, tricks, everyday moves and emotions.

Pose conventions are in anims.py. The root bone points up, so on `root`:
pitch noses the whole dog up/down, twist spins it in place (yaw) and side
rolls it onto its side.
"""
import math

from anims import CARRY, CROUCH, JAW_OPEN, LEAP, POSES, free, mouth_to, unsolved, wag  # noqa: F401

S, SI, L = POSES['stand'], POSES['sit'], POSES['lie']

# ---- rest ----
# Curled up like a fox: rolled a little onto one side, the whole spine bent
# round in a C, chin resting on the back legs, legs tucked into the middle,
# tail wrapped round the nose. (A plain pose: no planting, set on the floor.)
# Curled up asleep, built on the lie: the body bends round into a C, hips
# rolled a little onto one side, the front paws stretched out flat in front,
# the head dropped so the chin rests on the floor between them, the tail
# wrapped round toward the nose.
CURL = {**L, 'root': (0, 12, 0), 'pelvis': (0, 34, 0), 'spine': (0, 18, 0), 'chest': (0, 16, 0),
        'neck': (-30, 30, 0), 'head': (8, 10, 0), 'tail': (-35, 125, 0), '_level': ['head'], '_upright': ['head'],
        '_dirs': {**L['_dirs'], 'wrist.*': (1, 0), 'paw.*': (1, 0), 'tail': (-0.2, 1)},
        '_feet': {'front': ('by_head', 0.22, 0.34)},
        '_body': {'params': ['root_up', 'spine', 'neck'],
                  'res': [('seat', 0.0), ('feet', 0), ('chest_z', 0.0), ('mouth_z', 0.1)],
                  'init': {'root_up': -0.6, 'neck': -30}, 'bounds': {'spine': (-15, 10), 'neck': (-90, 10)}}}
CURL['_dirs'].pop('tail')
# Halfway: head turning round, body starting to bend.
HALF_CURL = {**L, 'neck': (-14, 25, 0), 'head': (-6, 12, 0), 'pelvis': (0, 15, 0), 'spine': (0, 8, 0)}
CURL_IN = {**CURL, 'chest': (1.5, 16, 0)}                                    # breath
CURL_SIGH = {**CURL, 'chest': (3.5, 16, 0)}           # a bigger breath now and then
# Flopped on its side, legs loose and long, head on the floor.
SIDE = {'root': (0, 88, 0), 'neck': (-20, 0, 0), 'head': (-5, 0, 0), 'upperarm.*': (25, 0, 0),
        'forearm.*': (10, 0, 0), 'thigh.*': (25, 0, 0), 'shin.*': (-15, 0, 0), 'tail': (-40, 0, 0)}
SIDE_IN = {**SIDE, 'chest': (0.8, 0, 0)}                                      # breath only
# Dreaming: only the paws twitch.
SIDE_TWITCH = {**SIDE_IN, 'wrist.L': (-25, 0, 0), 'paw.L': (-20, 0, 0)}
SIDE_TWITCH_B = {**SIDE_IN, 'wrist.L': (5, 0, 0), 'hock.L': (-15, 0, 0), 'hind_paw.L': (-20, 0, 0)}

# ---- tricks ----
PAW = {**free(SI, 'front.R'), 'upperarm.R': (55, -8, 0), 'forearm.R': (-35, 0, 0), 'wrist.R': (-25, 0, 0)}
# Sit pretty: rump on the floor, torso up near vertical on the haunches, head
# level, paws tucked to the chest; back toes tuck forward so the knees stay low.
BEG = {**free(SI, 'front'), 'neck': (0, 0, 0), 'head': (2, 0, 0), 'tail': (0, 40, 0),
       # Back legs: heels on the floor just in front of the rump, toes forward.
       '_feet': {'hind': ('hip', 0.12, 0.03)}, '_knees_in': True,
       '_dirs': {**free(SI, 'front')['_dirs'], 'upperarm.*': (1, -0.35), 'forearm.*': (1, -0.45),
                 'wrist.*': (0.25, -1), 'paw.*': (-0.25, -1), 'hock.*': (1, 0), 'hind_paw.*': (1, 0)},
       '_body': {'params': ['root_up', 'spine', 'pelvis'],
                 'res': [('seat', 0.0), ('back', 74, 86), ('feet', 0)],
                 'init': {'spine': 55, 'root_up': -0.2}, 'bounds': {'spine': (20, 95), 'pelvis': (-40, 40)}}}
# Paws bob: forearms swing forward a little.
BEG_B = {**BEG, '_dirs': {**BEG['_dirs'], 'forearm.*': (1, -0.3), 'wrist.*': (0.6, -1), 'paw.*': (0.1, -1)}}
# Roll over: legs folded to the belly while going over.
TUCK = {'neck': (-10, 0, 0), 'upperarm.*': (70, 0, 0), 'forearm.*': (-120, 0, 0), 'thigh.*': (85, 0, 0),
        'shin.*': (-140, 0, 0), 'tail': (-10, 0, 0)}


def paddle(phase, roll):
    """On its back, legs paddling loosely in the air, body squirming."""
    a = 22 if phase == 0 else -22
    # Head turned onto its side (ears lie sideways, not jammed into the floor).
    return {**TUCK, 'root': (0, roll, 0), 'spine': (0, a * 0.4, 0), 'neck': (-50, -a * 0.6, 0), 'head': (-10, 0, 60 + a),
            'jaw': (-18, 0, 0),
            'upperarm.L': (55 + a, 0, 0), 'upperarm.R': (55 - a, 0, 0), 'forearm.*': (-80, 0, 0),
            'thigh.L': (60 - a, 0, 0), 'thigh.R': (60 + a, 0, 0), 'shin.*': (-90, 0, 0), 'tail': (-20, a, 0)}


# Play dead: flopped on its side; the top legs sag down onto the bottom ones,
# paws limp, mouth a little open.
DEAD = {'root': (0, 92, 0), 'neck': (-10, 0, 0), 'head': (0, 0, -6), 'jaw': (-14, 0, 0),
        'upperarm.L': (65, 0, 0), 'forearm.L': (-55, 0, 0), 'thigh.L': (55, 0, 0), 'shin.L': (-75, 0, 0),
        # Top (right) legs sag down onto the bottom ones, paws limp.
        'upperarm.R': (55, 32, 0), 'forearm.R': (-50, 10, 0), 'wrist.R': (-35, 0, 0),
        'thigh.R': (48, 28, 0), 'shin.R': (-70, 8, 0), 'hock.R': (-15, 0, 0), 'tail': (-40, 0, 0)}
TILT_L = {**SI, 'head': (0, 0, 28), 'neck': (-12, 0, 0)}
TILT_R = {**SI, 'head': (0, 0, -24), 'neck': (-12, 0, 0)}


def step(phase, a=18):
    """A stepping pose for turning in place; phase 0/1 alternates diagonals."""
    a = a if phase == 0 else -a
    return {'upperarm.L': (a, 0, 0), 'upperarm.R': (-a, 0, 0), 'thigh.L': (-a, 0, 0), 'thigh.R': (a, 0, 0),
            'forearm.L': (-abs(a) * 1.6 if a > 0 else 0, 0, 0), 'forearm.R': (-abs(a) * 1.6 if a < 0 else 0, 0, 0),
            'shin.L': (-abs(a) * 1.4 if a < 0 else 0, 0, 0), 'shin.R': (-abs(a) * 1.4 if a > 0 else 0, 0, 0)}


# ---- everyday ----
# Scratch: from the sit, the left back leg swings forward and up beside the
# chest, the head bends down and round to meet it, and the paw kicks fast.
_SCR = free(SI, 'hind.L')
SCRATCH = {**_SCR, 'spine': (0, 16, 0), 'chest': (0, 14, 0), 'neck': (-30, 30, 0), 'head': (-10, 20, 22),
           'thigh.L': (0, 22, 0),
           '_dirs': {**_SCR['_dirs'], 'thigh.L': (0.8, 0.6), 'shin.L': (0.2, 1), 'hock.L': (1, 0.5),
                     'hind_paw.L': (1, 0.2)}}
SCRATCH_B = {**SCRATCH, '_dirs': {**SCRATCH['_dirs'], 'shin.L': (-0.15, 1), 'hock.L': (1, 0.9)}}
# Big yawn: breathe in with the head back, stretch the mouth all the way open
# with the neck long, quiver at the top, snap shut, smack.
YAWN_IN = {**SI, 'neck': (14, 0, 0), 'head': (12, 0, 0), 'jaw': (-12, 0, 0)}
YAWN = {**SI, 'neck': (22, 0, 0), 'head': (34, 0, 0), 'jaw': (-78, 0, 0)}
YAWN_Q = {**YAWN, 'jaw': (-70, 0, 0), 'head': (33, 0, 2)}
# Nose to the ground, sweeping side to side.
SNIFF = mouth_to(0.2, head=-35)
SNIFF_B = {**SNIFF, 'head': (-38, 10, 0), 'tail': (-25, 12, 0)}
# Dig: back paws planted wide, rump up, chest down, head down watching the
# hole; front paws scoop in turn - reach forward and down, rake back under
# the chest - fast.
DIG = {'spine': (-10, 0, 0), 'pelvis': (6, 0, 0), 'neck': (-38, 0, 0), 'head': (-22, 0, 0), 'tail': (-55, 0, 0),
       '_feet': {'hind': 'rest'}, '_root': (-0.04, -0.12)}
_REACH = {'upperarm': (0.75, -1), 'forearm': (1, -0.55), 'wrist': (1, -0.2), 'paw': (1, -0.4)}
_RAKE = {'upperarm': (-0.55, -1), 'forearm': (-1, -0.3), 'wrist': (-1, 0.4), 'paw': (-1, 0.3)}


def dig(phase, wag_=0):
    """One paw reaches forward and scoops down, the other rakes back under the
    chest, lifted; back paws stay planted."""
    reach, rake = ('at', 0.3, 0.0), ('at', -0.25, 0.18)
    a, b = (reach, rake) if phase == 0 else (rake, reach)
    return {**DIG, 'tail': (-55, wag_, 0), 'pelvis': (6, -wag_ * 0.2, 0),
            '_feet': {'hind': 'rest', 'front.L': a, 'front.R': b}}


def big_shake(k, n):
    """Full wet-dog shake: the whole body twists hard side to side, the wave
    running from the head to the tail, paws planted; strongest in the middle."""
    env = math.sin(math.pi * (k + 0.5) / n) ** 0.7
    a = (34 if k % 2 == 0 else -34) * env
    return {'root': (0, a * 0.35, 0), 'head': (0, a * 0.3, a), 'neck': (2, a * 0.3, a * 0.9),
            'chest': (0, a * 0.2, a * 0.8), 'spine': (0, -a * 0.25, -a * 0.6), 'pelvis': (0, -a * 0.4, -a * 0.9),
            'tail': (-20, a * 1.6, 0), 'jaw': (-10, 0, 0), '_plant': ['all'], '_root': (0, -0.04), '_ease': 'linear'}


def shake(t_phase):
    """Wet-dog shake: a roll wave travelling from the head to the tail."""
    a = 28 if t_phase % 2 == 0 else -28
    return {'head': (0, 0, a), 'neck': (0, 0, a * 0.8), 'chest': (0, 0, a * 0.6), 'spine': (0, 0, -a * 0.4),
            'pelvis': (0, 0, -a * 0.6), 'tail': (0, a * 1.5, 0), 'jaw': (-8, 0, 0), '_plant': ['all']}


# ---- emotions ----
# Happy: all four paws stay put while the rump swings side to side, panting,
# tail going, head bobbing.
HAPPY_A = {'spine': (3, -5, 0), 'neck': (10, 0, 0), 'head': (0, 0, 6), 'jaw': (-24, 0, 0), 'tail': (-50, 38, 0),
           'pelvis': (0, 14, 0), '_plant': ['all']}
HAPPY_B = {**HAPPY_A, 'spine': (3, 5, 0), 'neck': (6, 0, 0), 'head': (0, 0, -6), 'jaw': (-18, 0, 0),
           'tail': (-50, -38, 0), 'pelvis': (0, -14, 0)}
SAD = {'neck': (-35, 0, 0), 'head': (-15, 0, 0), 'spine': (-3, 0, 0), 'tail': (45, 0, 0), '_plant': ['all']}
# Cowering: paws planted, the whole dog sunk low and backing off, rump tucked
# under, tail clamped between the legs, head low and turned away, a small tremble.
SCARED = {'spine': (-4, 0, 0), 'pelvis': (22, 0, 0), 'neck': (-30, -14, 0), 'head': (-12, -10, -8),
          'tail': (95, 0, 0), '_plant': ['all'], '_root': (-0.12, -0.2)}
SCARED_B = {**SCARED, 'neck': (-30, -12, 0), 'head': (-12, -9, -6)}
SCARED_LOOK = {**SCARED, 'neck': (-24, 6, 0), 'head': (-6, 4, 4)}      # a nervous glance back
GROWL = {'spine': (-4, 0, 0), 'neck': (-10, 0, 0), 'head': (-8, 0, 0), 'jaw': (-12, 0, 0), 'tail': (-60, 0, 0),
         'upperarm.*': (6, 0, 0), '_plant': ['all']}
GROWL_B = {**GROWL, 'jaw': (-16, 0, 0), 'head': (-9, 0, 0)}
# Howl: muzzle pointing at the sky, throat long.
HOWL = {**SI, 'neck': (40, 0, 0), 'head': (50, 0, 0), 'jaw': (-38, 0, 0)}
# Excited bounce: back paws planted; the front end springs up with the front
# legs tucking in the air, lands into a little crouch, again - panting, wagging.
BOUNCE_UP = {'spine': (16, 0, 0), 'neck': (10, 0, 0), 'head': (-4, 0, 0), 'jaw': (-24, 0, 0), 'tail': (-55, 30, 0),
             'upperarm.*': (30, 0, 0), 'forearm.*': (-75, 0, 0), 'wrist.*': (-30, 0, 0),
             '_feet': {'hind': 'rest'}, '_ease': 'out'}
BOUNCE_DN = {'spine': (-6, 0, 0), 'neck': (2, 0, 0), 'jaw': (-18, 0, 0), 'tail': (-55, -30, 0),
             '_plant': ['all'], '_root': (0, -0.1), '_ease': 'in'}


def spin_keys(turn=-360):
    """Dip, then whip round with the head leading and the body curved into the
    turn, accelerating, overshoot and settle, a happy hop at the end."""
    sg = 1 if turn > 0 else -1
    curve = {'spine': (0, 14 * sg, 0), 'chest': (0, 10 * sg, 0), 'neck': (0, 22 * sg, 0), 'head': (0, 12 * sg, 0)}
    keys = [(0, S), (0.15, {**S, 'spine': (-6, 0, 0), 'neck': (-12, 0, 0), 'tail': (-45, 0, 0), '_root': (0, -0.05)})]
    fr = [0.04, 0.18, 0.38, 0.6, 0.82, 0.97]          # fraction of the turn at each step: slow, fast, slow
    for k, f in enumerate(fr):
        keys.append((0.25 + 0.1 * k, {**step(k % 2, 24), **curve, 'root': (0, 0, turn * f),
                                      'tail': (-40, -30 * sg, 0), '_ease': 'linear'}))
    keys.append((0.9, {**step(0, 10), 'root': (0, 0, turn * 1.03), 'neck': (8, -6 * sg, 0), 'tail': (-50, 20 * sg, 0)}))
    keys.append((1.02, {'root': (0, 0, turn), 'neck': (10, 0, 0), 'tail': (-50, -25, 0), '_air': 0.04}))
    keys.append((1.2, {'root': (0, 0, turn), 'tail': (-45, 20, 0)}))
    return keys


def roll_keys():
    """Lean and look the way it's going, flop onto its side, squirm on its back
    with the legs paddling, carry on over, push back up, shake the head."""
    lean = {**L, 'root': (0, -10, 0), 'neck': (-14, 25, 0), 'head': (-8, 0, 15)}
    return [(0, L), (0.25, lean), (0.45, {**TUCK, 'root': (0, 80, 0), '_ease': 'in'}),
            (0.6, paddle(0, 170)), (0.72, paddle(1, 185)), (0.84, paddle(0, 175)), (0.96, paddle(1, 190)),
            (1.15, {**TUCK, 'root': (0, 290, 0), '_ease': 'snap'}),
            (1.35, {**L, 'root': (0, 360, 0), 'neck': (4, 0, 0)}),
            (1.45, {**L, 'root': (0, 360, 0), 'head': (0, 0, 18)}), (1.55, {**L, 'root': (0, 360, 0), 'head': (0, 0, -18)}),
            (1.75, {**L, 'root': (0, 360, 0)})]


CLIPS = [
    ('sleep_curl', True, [(0, CURL), (1.6, CURL_IN), (3.2, CURL), (4.4, CURL_SIGH), (5.6, CURL)]),
    ('sleep_side', True, [(0, SIDE), (1.4, SIDE_IN), (1.9, SIDE_TWITCH), (2.0, SIDE_IN), (2.1, SIDE_TWITCH),
                          (2.25, SIDE_IN), (2.9, SIDE), (3.3, SIDE_TWITCH_B), (3.4, SIDE), (3.5, SIDE_TWITCH_B),
                          (3.7, SIDE), (4.4, SIDE_IN), (5.2, SIDE)]),
    # Lie, turn the head round to the back legs, curl the body in, settle.
    # Lie, turn the head round to look at the back legs, roll the hips over and
    # curl in around them, tuck the nose, settle with a sigh.
    ('lie_to_sleep', False, [(0, L), (0.5, HALF_CURL), (1.2, {**CURL, '_ease': 'out'}), (1.7, CURL_SIGH),
                             (2.3, CURL)]),
    ('head_tilt', False, [(0, SI), (0.3, TILT_L), (0.9, TILT_L), (1.15, TILT_R), (1.6, TILT_R), (1.9, SI)]),
    ('shake_paw', False, [(0, SI), (0.35, PAW), (0.55, {**PAW, 'forearm.R': (-25, 0, 0)}), (0.75, PAW),
                          (0.95, {**PAW, 'forearm.R': (-25, 0, 0)}), (1.3, SI)]),
    ('roll_over', False, roll_keys()),
    # "Bang!": flinch up, collapse onto the side (accelerating), a bounce on
    # landing, lie limp, then peek with a guilty tail wag.
    ('play_dead', False, [(0, S), (0.18, {**S, 'neck': (14, 0, 0), 'head': (8, 0, 0), 'spine': (4, 0, 0), '_root': (0, 0.03)}),
                          (0.5, {**DEAD, 'root': (0, 96, 0), '_ease': 'in'}), (0.62, {**DEAD, 'root': (0, 86, 0)}),
                          (0.75, DEAD), (2.0, DEAD), (2.2, {**DEAD, 'neck': (-4, 0, 0), 'head': (10, 0, -6)}),
                          (2.9, DEAD)]),
    ('spin', False, spin_keys()),
    ('scratch_ear', False, [(0, SI), (0.3, SCRATCH)] + [(0.3 + 0.07 * i, SCRATCH_B if i % 2 else SCRATCH)
                                                       for i in range(1, 12)] + [(1.4, SI)]),
    ('yawn', False, [(0, SI), (0.45, YAWN_IN), (1.0, {**YAWN, '_ease': 'out'})]
     + [(1.0 + 0.05 * k, YAWN_Q if k % 2 else YAWN) for k in range(1, 9)]
     + [(1.55, {**SI, 'jaw': (0, 0, 0), 'neck': (2, 0, 0), '_ease': 'in'}), (1.7, {**SI, 'jaw': (-10, 0, 0)}),
        (1.8, SI), (1.9, {**SI, 'jaw': (-8, 0, 0)}), (2.0, SI), (2.2, {**SI, 'head': (0, 0, 10)}), (2.45, SI)]),
    ('sniff', True, [(0, SNIFF), (0.25, SNIFF_B), (0.5, SNIFF), (0.75, SNIFF_B), (1.0, SNIFF)]),
    ('dig', True, [(0, dig(0, 25)), (0.12, dig(1, -25)), (0.24, dig(0, 25)), (0.36, dig(1, -25)), (0.48, dig(0, 25))]),
    ('shake_off', False, [(0, S)] + [(0.1 + 0.09 * i, shake(i)) for i in range(9)] + [(1.05, S)]),
    # Big whole-body shake: brace low, then twist hard and fast from nose to
    # tail, a few slowing wobbles, stand tall.
    ('shake_big', False, [(0, S), (0.2, {**S, 'spine': (-4, 0, 0), 'neck': (-8, 0, 0), '_plant': ['all'], '_root': (0, -0.06)})]
     + [(0.3 + 0.075 * k, big_shake(k, 12)) for k in range(12)]
     + [(1.3, {**S, 'neck': (12, 0, 0), '_plant': ['all']}), (1.6, S)]),
    ('happy', True, [(0, HAPPY_A), (0.18, HAPPY_B), (0.36, HAPPY_A)]),
    ('sad', True, [(0, SAD), (1.5, {**SAD, 'neck': (-38, 0, 0)}), (3.0, SAD)]),
    ('scared', True, [(0, SCARED)] + [(0.08 * k, SCARED_B if k % 2 else SCARED) for k in range(1, 10)]
     + [(1.1, SCARED_LOOK), (1.5, SCARED_LOOK), (1.9, SCARED)]),
    ('growl', True, [(0, GROWL), (0.12, GROWL_B), (0.24, GROWL)]),
    ('howl', False, [(0, SI), (0.6, HOWL), (2.2, {**HOWL, 'jaw': (-34, 0, 0)}), (2.6, SI)]),
    ('excited_bounce', True, [(0, BOUNCE_DN), (0.2, BOUNCE_UP), (0.36, {**BOUNCE_DN, 'tail': (-55, 30, 0)}),
                              (0.56, {**BOUNCE_UP, 'tail': (-55, -30, 0)}), (0.72, BOUNCE_DN)]),
    ('get_pet', True, [(0, wag({**S, 'neck': (-8, 0, 0), 'head': (0, 0, 12)}, 18)),
                       (0.3, wag({**S, 'neck': (-8, 0, 0), 'head': (0, 0, 16)}, -18)),
                       (0.6, wag({**S, 'neck': (-8, 0, 0), 'head': (0, 0, 12)}, 18))]),
]


# ---- locomotion ----
import math  # noqa: E402

# Each leg follows a phase (fraction of the cycle). The upper bone swings
# forward and back on a sine; while it swings forward the lower joints fold so
# the paw lifts clear. Played in place: the game moves the dog.
GAITS = {
    #        cycle s, swing deg, lift, leg phases (LF, RF, LH, RH), spine flex, head bob, tail sway
    'walk': (1.0, 22, 1.0, {'L': (0.25, 0.0), 'R': (0.75, 0.5)}, 0, 3, 14),
    'trot': (0.56, 20, 2.0, {'L': (0.0, 0.5), 'R': (0.5, 0.0)}, 0, 4, 10),
    'run': (0.46, 40, 1.4, {'L': (0.5, 0.05), 'R': (0.6, 0.0)}, 14, 6, 6),
    'sneak': (1.6, 10, 0.7, {'L': (0.25, 0.0), 'R': (0.75, 0.5)}, 0, 1, 4),
    'zoomies': (0.36, 46, 1.5, {'L': (0.5, 0.05), 'R': (0.6, 0.0)}, 20, 8, 0),
}
# Extra life per gait: body bounce (lift off the floor, dog-space units; two
# hops per cycle for walk/trot, one for the gallops), how much further the front
# legs swing than the back and how far forward they reach, body rock.
GAIT_FX = {
    'walk': dict(bounce=0.008, hops=2, front=1.05, reach=4, rock=1.5),
    'trot': dict(bounce=0.11, hops=2, front=1.1, reach=4, rock=0),
    'run': dict(bounce=0.07, hops=1, front=1.4, reach=16, rock=6),
    'sneak': dict(bounce=0.0, hops=2, front=1.0, reach=0, rock=0),
    'zoomies': dict(bounce=0.07, hops=1, front=1.35, reach=14, rock=6),
}


def gait_pose(name, f):
    T, A, lift, phases, flex, bob, sway = GAITS[name]
    fx = GAIT_FX[name]
    pose = {}
    for side, (pf, ph) in phases.items():
        for kind, ph0 in (('front', pf), ('rear', ph)):
            a = 2 * math.pi * (f - ph0)
            swing = math.sin(a)
            up = max(0.0, math.cos(a)) * lift          # foot clear while swinging forward
            if kind == 'front':
                # Front legs reach well forward (straight at full reach).
                pose[f'upperarm.{side}'] = (A * fx['front'] * swing + fx['reach'] * max(0.0, swing), 0, 0)
                pose[f'forearm.{side}'] = (-35 * up + 8 * max(0.0, swing) * (fx['reach'] > 8), 0, 0)
                pose[f'wrist.{side}'] = (-40 * up, 0, 0)
            else:
                pose[f'thigh.{side}'] = (A * swing, 0, 0)
                pose[f'shin.{side}'] = (-40 * up, 0, 0)
                pose[f'hock.{side}'] = (30 * up, 0, 0)
    c = math.cos(4 * math.pi * f)
    pose['spine'] = (flex * math.sin(2 * math.pi * f), 0, 0)
    pose['neck'] = (bob * c, 0, 0)
    pose['tail'] = (-30, sway * math.sin(2 * math.pi * f), 0)
    # Up-down drive: airborne between pushes, the body rocking nose-up as it lifts.
    hop = (0.5 + 0.5 * math.cos(2 * math.pi * fx['hops'] * (f - 0.25))) ** 2
    pose['_air'] = fx['bounce'] * hop
    pose['root'] = (fx['rock'] * math.sin(2 * math.pi * fx['hops'] * (f - 0.25)), 0, 0)
    pose['neck'] = (pose['neck'][0] - 4 * hop * (fx['bounce'] > 0.02), 0, 0)    # head bobs against the lift
    if name == 'zoomies':
        # Tucked-butt sprint: pelvis curled under, tail clamped, head low, mouth open.
        pose.update({'pelvis': (14 + pose['spine'][0] * 0.5, 0, 0), 'neck': (-12 + bob * c, 0, 0),
                     'tail': (55, 10 * math.sin(2 * math.pi * f), 0), 'jaw': (-24, 0, 0)})
    if name == 'sneak':
        # Stalking: low, head down in line with the back, paws placed carefully
        # (legs swing more forward than back).
        pose.update({'spine': (-4, 0, 0), 'neck': (-42 + bob * c, 0, 0), 'head': (-6, 0, 0), 'tail': (30, 0, 0)})
        for side in 'LR':
            for b in ('upperarm', 'thigh'):
                pose[f'{b}.{side}'] = (pose[f'{b}.{side}'][0] + 5, 0, 0)
        for side in 'LR':
            pose[f'forearm.{side}'] = (pose[f'forearm.{side}'][0] - 20, 0, 0)
            pose[f'shin.{side}'] = (pose[f'shin.{side}'][0] - 30, 0, 0)
            pose[f'hock.{side}'] = (pose[f'hock.{side}'][0] + 20, 0, 0)
    return pose


def gait_keys(name, n=12):
    T = GAITS[name][0]
    return [(T * i / n, gait_pose(name, i / n)) for i in range(n + 1)]


CLIPS += [(name, True, gait_keys(name)) for name in GAITS]


# ---- third batch: toys, food, everyday, tricks ----
def pant(pose, open_):
    return {**pose, 'jaw': (-open_, 0, 0)}


def head_shake(pose, side, k=1.0):
    """Toy shake / tug: the head and neck swing sideways together."""
    return {**pose, 'neck': (pose.get('neck', (0, 0, 0))[0], side * 0.6 * k, 0),
            'head': (pose.get('head', (0, 0, 0))[0], side * 0.5 * k, side * 0.3 * k)}


HAPPY_IDLE = {'spine': (2, 0, 0), 'neck': (10, 0, 0), 'head': (-4, 0, 0), 'tail': (-50, 0, 0)}
# Tug: braced back on planted paws, rump low, head low and pulling.
TUG = {'spine': (-8, 0, 0), 'pelvis': (10, 0, 0), 'neck': (-20, 0, 0), 'head': (12, 0, 0), 'tail': (-40, 0, 0),
       '_plant': ['all'], '_root': (-0.14, -0.06)}
TUG_BACK = {**TUG, '_root': (-0.2, -0.08), 'spine': (-11, 0, 0)}
# Chew: sphinx with the front legs out flat, the toy held between the paws.
CHEW = {**L, 'neck': (-55, 0, 0), 'head': (-45, 0, 0), '_level': ['neck', 'head'],
        '_dirs': {**{k: v for k, v in L['_dirs'].items() if not k.startswith(('upperarm', 'forearm', 'wrist', 'paw'))},
                  'upperarm.*': (0.7, -1), 'forearm.*': (1, -0.02), 'wrist.*': (1, 0), 'paw.*': (1, 0)}}
SNAP_UP = {'neck': (20, 0, 0), 'head': (22, 0, 0), **JAW_OPEN}
WIND = {'neck': (-18, 30, 0), 'head': (-6, 20, 0), 'spine': (0, 8, 0)}
FLICK = {'neck': (26, -35, 0), 'head': (20, -25, 0), 'spine': (0, -8, 0), **JAW_OPEN}
# Head in a bowl (nose pointing down into it).
EAT = mouth_to(0.3)
DRINK = mouth_to(0.22)
# Sneeze: the nose wrinkles up and back (breath in, chest up), then the whole
# neck and head get thrown down hard, the front end dipping with it.
SNEEZE_UP = {'neck': (22, 0, 0), 'head': (24, 0, 0), 'jaw': (-14, 0, 0), 'spine': (4, 0, 0), '_plant': ['all']}
SNEEZE_UP2 = {**SNEEZE_UP, 'neck': (26, 0, 0), 'head': (28, 0, 0), 'jaw': (-20, 0, 0)}
SNEEZE = {'neck': (-62, 0, 0), 'head': (-30, 0, 0), 'jaw': (-22, 0, 0), 'spine': (-8, 0, 0), 'tail': (-20, 0, 0),
          '_plant': ['all'], '_root': (0.04, -0.06), '_ease': 'in'}


def wiggle(side):
    """Greeting wiggle: the whole body curves into a C, alternating, tail spinning."""
    return {'spine': (0, 10 * side, 0), 'pelvis': (0, -16 * side, 0), 'chest': (0, 6 * side, 0),
            'neck': (-14, -10 * side, 0), 'head': (4, 0, 8 * side), 'jaw': (-20, 0, 0),
            'tail': (-30, 40 * side, 0), 'thigh.*': (6, 0, 0)}


TREAT_REACH = {**SI, 'neck': (24, 0, 0), 'head': (-6, 0, 0), **JAW_OPEN}
NUDGE = {'neck': (-22, 0, 0), 'head': (14, 0, 0), 'spine': (-2, 0, 0), '_plant': ['all'], '_root': (0.08, 0)}
# Shy: chin down on the floor, one front paw draped over the muzzle.
_SHY = free(L, 'front.R')
SHY = {**_SHY, 'neck': (-45, 12, 0), 'head': (-22, 8, -10), '_level': ['neck', 'head'],
       '_dirs': {**_SHY['_dirs'], 'upperarm.R': (1, -0.75), 'forearm.R': (1, 0.55), 'wrist.R': (1, -0.7),
                 'paw.R': (0.6, -1)}}
SHY_B = {**SHY, 'head': (-26, 10, -14), 'tail': (0, 50, 0)}


def crawl(phase):
    """Belly-crawl: lying low, one front paw reaching ahead while the other pulls
    back, the back legs pushing in turn; head low and level."""
    reach, pull = ((1, -0.55), (1, -0.15)), ((-1, -0.6), (1, 0.3))
    fl, fr = (reach, pull) if phase == 0 else (pull, reach)
    hl, hr = ((1, -0.6), (0.6, -0.05)) if phase == 0 else ((0.6, -0.05), (1, -0.6))
    return {**L, 'neck': (-20, 0, 0), 'head': (-4, 0, 0), 'tail': (5, 0, 0), '_level': ['neck', 'head'],
            '_dirs': {'upperarm.L': fl[0], 'forearm.L': fl[1], 'upperarm.R': fr[0], 'forearm.R': fr[1],
                      'wrist.*': (1, 0), 'paw.*': (1, 0),
                      'thigh.L': hl, 'thigh.R': hr, 'shin.*': (-1, -0.15), 'hock.*': (1, 0), 'hind_paw.*': (1, 0),
                      'tail': (-1, 0.05)}}


# Up on the hind legs, front paws dangling, balancing.
HIND = {'spine': (62, 0, 0), 'pelvis': (-18, 0, 0), 'neck': (-50, 0, 0), 'head': (-4, 0, 0), 'tail': (-20, 0, 0),
        'upperarm.*': (-10, 0, 0), 'forearm.*': (-55, 0, 0), 'wrist.*': (-45, 0, 0),
        '_dirs': {'thigh.*': (0.25, -1), 'shin.*': (-0.3, -1), 'hock.*': (0.15, -1), 'hind_paw.*': (1, 0)}}
HIND_B = {**HIND, 'spine': (64, 0, 0), 'forearm.*': (-65, 0, 0), 'tail': (-20, 25, 0)}
HIND_GATHER = {**CROUCH, 'spine': (12, 0, 0), 'neck': (10, 0, 0)}
BALANCE = {**SI, 'neck': (0, 0, 0), 'head': (4, 0, 0)}
BALANCE_FLICK = {**SI, 'neck': (14, 0, 0), 'head': (34, 0, 0)}
BALANCE_CATCH = {**SI, 'neck': (8, 0, 0), 'head': (14, 0, 0), **JAW_OPEN}


# Leg lift: the left back leg swings out sideways, weight over the other three.
PEE = {**free(S, 'hind.L'), 'thigh.L': (20, 75, 0), 'shin.L': (-35, 0, 0), 'hock.L': (25, 0, 0),
       'spine': (0, -5, 0), 'pelvis': (0, -6, 0), 'tail': (-35, 0, 0), 'neck': (-4, 0, 0)}


def turn_keys(deg, T=0.8, n=4):
    """In-place turn: the root yaws while the legs step."""
    return [(T * i / n, {**(step(i % 2) if 0 < i < n else {}), 'root': (0, 0, deg * i / n),
                         'tail': (-30, -deg / 9 if 0 < i < n else 0, 0)}) for i in range(n + 1)]


def chew_keys():
    return [(i * 0.2, {**CHEW, 'head': (-45, 0, 14 if i % 2 else -8), 'jaw': (-6 if i % 2 else -20, 0, 0)})
            for i in range(7)]


CLIPS += [
    ('idle_happy', True, [(i * 0.15, wag(pant(HAPPY_IDLE if i % 2 == 0 else {**HAPPY_IDLE, 'spine': (3.5, 0, 0)},
                                              18 if i % 2 else 26), 32 if i % 2 == 0 else -32)) for i in range(5)]),
    ('stand_hind', False, [(0, S), (0.3, HIND_GATHER), (0.65, HIND), (1.0, HIND_B), (1.35, HIND), (1.7, HIND_B),
                           (2.15, HIND_GATHER), (2.5, S)]),
    ('crawl', True, [(0, crawl(0)), (0.4, crawl(1)), (0.8, crawl(0))]),
    ('shy', False, [(0, L), (0.45, SHY), (1.2, SHY_B), (1.7, SHY), (2.2, L)]),
    # Treat on the nose (the game puts it on socket_nose): hold dead still, flip it
    # up at 1.6 s, catch it at 1.95 s (grip goes 0 -> 1), chew, happy.
    ('balance_treat', False, [(0, {**BALANCE, '_grip': 0}), (1.45, {**BALANCE, '_grip': 0}),
                              (1.6, {**BALANCE_FLICK, '_grip': 0}), (1.9, {**BALANCE_CATCH, '_grip': 0}),
                              (1.95, {**BALANCE, '_grip': 1}), (2.15, {**BALANCE, 'jaw': (-14, 0, 0), '_grip': 1}),
                              (2.35, {**BALANCE, '_grip': 1}), (2.55, {**BALANCE, 'jaw': (-14, 0, 0), '_grip': 1}),
                              (2.9, wag({**SI, '_grip': 1}, 20))]),
    ('catch_standing', False, [(0, {'_grip': 0}), (0.2, {'neck': (-4, 0, 0), '_grip': 0}),
                               (0.4, {**SNAP_UP, '_grip': 0}), (0.42, {**SNAP_UP, 'jaw': (0, 0, 0), '_grip': 1}),
                               (0.8, {**CARRY, '_grip': 1})]),
    ('tug', True, [(0, head_shake(TUG, 25)), (0.15, head_shake(TUG_BACK, -25)), (0.3, head_shake(TUG, 25)),
                   (0.45, head_shake(TUG_BACK, -25)), (0.6, head_shake(TUG, 25))]),
    ('chew', True, chew_keys()),
    ('toss', False, [(0, CARRY), (0.3, WIND), (0.45, {**FLICK, 'jaw': (0, 0, 0)}),
                     (0.47, {**FLICK, '_grip': 0}), (0.75, {**FLICK, 'neck': (10, 0, 0), 'head': (0, 0, 0), '_grip': 0}),
                     (1.1, {'neck': (6, 0, 0), '_grip': 0})]),
    ('shake_toy', False, [(0, CARRY)] + [(0.1 + 0.08 * i, head_shake(CARRY, 40 if i % 2 else -40))
                                         for i in range(10)] + [(1.1, CARRY)]),
    ('eat', True, [(0, EAT), (0.2, {**EAT, 'jaw': (-22, 0, 0)}), (0.4, EAT), (0.6, {**EAT, 'jaw': (-22, 0, 0)}),
                   (0.8, EAT)]),
    ('drink', True, [(0, DRINK), (0.12, {**DRINK, 'jaw': (-14, 0, 0)}), (0.24, DRINK)]),
    ('sneeze', False, [(0, S), (0.3, SNEEZE_UP), (0.5, SNEEZE_UP2), (0.58, SNEEZE), (0.7, {**SNEEZE, 'neck': (-55, 0, 0)}),
                       (0.9, {**S, 'neck': (4, 0, 0)}), (1.0, head_shake(S, 18)), (1.1, head_shake(S, -18)),
                       (1.2, head_shake(S, 10)), (1.4, S)]),
    ('greet', False, [(0, S)] + [(0.15 + 0.2 * i, wiggle(1 if i % 2 else -1)) for i in range(7)] + [(1.75, S)]),
    ('receive_treat', False, [(0, SI), (0.3, TREAT_REACH), (0.4, {**SI, 'neck': (20, 0, 0)}),
                              (0.6, {**SI, 'jaw': (-14, 0, 0)}), (0.8, SI), (1.0, {**SI, 'jaw': (-14, 0, 0)}),
                              (1.3, wag(SI, 20)), (1.5, wag(SI, -20))]),
    ('nudge', False, [(0, S), (0.25, NUDGE), (0.45, {**S, 'neck': (-10, 0, 0)}), (0.7, NUDGE), (1.1, S)]),
    ('pee', False, [(0, S), (0.4, PEE), (1.8, {**PEE, 'tail': (-35, 8, 0)}), (2.2, S)]),
    ('turn_left', False, turn_keys(90)),     # + root twist = yaw to the dog's left
    ('turn_right', False, turn_keys(-90)),
    # Onto / off a ledge: the clip's root rises / falls by 0.25 (dog-space units).
    ('jump_up', False, [(0, S), (0.25, CROUCH), (0.45, {**LEAP, '_air': 0.3}),
                        (0.65, {**LEAP, 'thigh.*': (20, 0, 0), '_air': 0.36}), (0.8, {**CROUCH, '_air': 0.25}),
                        (1.1, {'_air': 0.25})]),
    ('jump_down', False, [(0, {'_air': 0.25}), (0.2, {**CROUCH, '_air': 0.25}), (0.4, {**LEAP, '_air': 0.3}),
                          (0.65, {**LEAP, 'spine': (-6, 0, 0), 'neck': (0, 0, 0), '_air': 0.06}),
                          (0.75, {**CROUCH, '_air': 0.0}), (1.05, S)]),
    ('land', False, [(0, {**LEAP, 'spine': (-6, 0, 0), '_air': 0.12}), (0.12, {**CROUCH, '_air': 0.0}),
                     (0.45, S)]),
    ('carry_walk', True, [(t, {**p, **CARRY}) for t, p in gait_keys('walk')]),
    ('walk_back', True, [(t, p) for (t, _), (_, p) in zip(gait_keys('walk'), reversed(gait_keys('walk')))]),
]
