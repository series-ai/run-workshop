# Harvest Haul: asset list (concept stage)

Cozy farming kit: 82 crops, pumpkins and gourds, cornucopias, harvest props, tools and machinery, farm structures and farmer kids. Everything is procedural Blender geometry (`concepts/*.py` on top of `shared/kit.py`): flat-shaded, low-poly, flat colour per part, and no textures. Crops are face-free. The faces in the pack are the scarecrow heads and the farmer kids (the Boo Brigade kids).

Boards: `concepts/renders/01-crops-a.png` … `26-farm-scale.png` (26 boards, 819 cells). Round 1 is boards 01–09; round 2 is boards 10–26.

## Look rules used

- Chubby and toy-like. `hh.leaf` widens every leaf by 1.3× with a minimum thickness, and `hh.stalk` never goes thinner than 0.028. Produce is drawn oversize.
- The palette is pumpkin orange, mustard, barn red, sage, cream and soft brown, with saturated produce on soft wood and soil neutrals.
- Each item's best side is turned about 25° toward the 3/4 camera.

## 1. Crops: 15 crops, 91 stage models + 15 produce items

Every crop's stages sit on the **same soil mound** (`hh.MOUND`: r 0.47, top z 0.162), so stages swap in place.

| Crop | Stages | Ripe stage shows | Produce item |
|---|---|---|---|
| Pumpkin | 6 | big orange pumpkin on the vine | pumpkin with leafy stem |
| Corn | 6 | 2 husked cobs, golden tassel | half-peeled cob |
| Wheat | 6 | golden fat ears | tied sheaf |
| Carrot | 6 | orange shoulder poking out | carrot with tops |
| Potato | 6 | potatoes poking out of the mound | 2 potatoes |
| Tomato (staked) | 6 | red clusters | tomato with calyx |
| Cabbage | 6 | tight head in outer leaves | cabbage head |
| Beetroot | 6 | magenta shoulder, red stems | beet with leaves |
| Sunflower | 6 | big head facing camera | flower head |
| Squash vine | 6 | yellow crooknecks | crookneck |
| Bean pole (teepee) | 6 | hanging pods | pod bundle |
| Strawberry (straw mulch) | 6 | red berries over the edge | 2 berries |
| Eggplant | 6 | hanging aubergines | aubergine |
| Onion | 6 | golden bulb, tops flopped | onion |
| Apple tree | **7** (adds blossom) | red apples | apple with leaf |

Stage set: planted (dimple, seeds, little wooden label in the crop colour) → sprout (two seed leaves; grass blades for corn, wheat and onion) → young → mature (flowers or green fruit) → ripe → withered (tan droop, dull shrivelled fruit). The apple tree runs planted → sprout → sapling → mature → blossom → ripe → withered.

## 2. Pumpkins & gourds: a mix-and-match system (`gourds.py`)

A gourd is **body + stem + warts + skin + scale**.

- **Bodies (12):** round, tall, flat, squat, turban (with a separate cap), acorn, oval (laid on its side), neck (butternut), pear, bottle, crown, swan (spline tube). Lathe bodies carry a surface map (`Gourd.surf`), so stripes, warts, speckles and carved faces sit on the actual faceted skin.
- **Stems (7):** stub, tall, curly, leafy (leaf + tendril), giant (cut top), dry, nub.
- **Warts (5):** none, few, many, knobbly, crown spikes.
- **Skins (15):** orange, ghost white, cinder red, jarrah blue, cream stripe (groove stripes), goblin (two-tone), prize, butternut, acorn green (+ orange spot), spaghetti, speckled (two-tone + speckles), swan green, bottle, crown, withered.
- **Varieties (16 recipes):** classic orange, giant prize, mini, white ghost, Cinderella, blue Jarrahdale, warty goblin, green-striped, turban, butternut, acorn, spaghetti, swan-neck, bottle, crown of thorns and speckled pear.
- **Prize sizes (4):** small, big, huge, record-breaker. The record-breaker sits on a pallet with a 1st-place rosette, and the bigger sizes slump into the squat body.
- **Carved face inserts (6):** classic, happy, spooky, surprised, wink, toothy. They are dark slabs wrapped onto the skin (`hh.decal`). Each has a lit variant (warm emissive) and fits any lathe body: shown on the ghost, tall, Jarrahdale and goblin bodies.

## 3. Cornucopias (`horn.py`)

- **Horn:** a tapering curled tube with alternating weave bands, a rim and a dark mouth. It comes in 3 sizes (0.75 / 1.0 / 1.3) and 2 trims (wicker; gold bands + red bow).
- **Fill pieces (9, free mixing):** mini pumpkin, pear gourd, corn, apple (red or orange), grapes, wheat bunch, pear, nuts (acorns + walnut), maple leaf (orange or mustard). They are drawn at 1.6× toy scale next to the horn.
- **Filled examples (3):** small, medium and large gold, built only from the pieces above via a `SPILL` placement list.

## 4. Props (`props.py`)

- **Soil plot** (raised bed): dry, tilled, watered, and tilled with a crop mound (shows that the crop mound fits the plot).
- **Wheelbarrow:** empty and loaded.
- **Baskets:** bushel (empty or apples), handle basket (potatoes), trug (carrots).
- **Crates:** empty, apples, pumpkins, corn.
- **Hay:** round bale, square bale, bale stack.
- **Fence:** straight, corner, gate (barn red, ajar).
- **Market stall:** striped awning, scalloped valance and sign; stocked or bare. Stocked uses only kit parts.
- **Other:** watering can, weighing scale (empty or with a pumpkin), prize rosettes for 1st, 2nd and 3rd on a little stand.

## 5. Scarecrow kit

Snap points: the **neck** is at the top of the post (`NECK`), and the **hat anchor** comes from the head (top z and radius, so hats scale to the head). Outfits wrap the post torso and the crossbar arms.

- **Posts (2):** cross post, leaning post (both on a soil mound).
- **Heads (5, chibi 1.7×):** sack, pumpkin (reuses the carved "happy" insert), turnip, straw, bucket. All except the pumpkin get bead eyes, a smile and blush.
- **Hats (5):** sun hat, pointy, top hat, flat cap, flower pot.
- **Outfits (4):** plaid shirt, overalls, long coat, sack tunic, each with straw tufts at the cuffs and hem.
- **Combos (5):** Classic, Spooky Jack, Turnip Tom, Bucket Bert, Gentleman Straw.


# Round 2

## 6. The big crop set: 67 more crops (82 in total)

Every crop has the same stage scaffold on the shared mound. Fruit trees, palms and cacao have **7 stages** (planted, sprout, sapling, mature, blossom, ripe, withered); everything else has **6** (planted, sprout, young, mature, ripe, withered). Every crop also has a harvested-produce item, shown as the last cell of its row and zoomed to read.

The shared grammars live in `concepts/grow.py`:

- `opener` gives stages 0–1 for every crop.
- `rosette` covers leafy, root and allium crops. `withered_rosette` is the shared dead stage.
- `field_clump` covers grains.
- `bush` covers berries, coffee, tea, roses and marigolds.
- `tree` covers fruit trees. Canopy shape, leaf, blossom, fruit and dropped fruit are parameters.
- `palm` covers banana and coconut.
- `vine_climb` and `ground_vine` cover vines.

Each crop then adds its own silhouette and produce in `crops2.py` and `crops3.py`.

| Board | Crops |
|---|---|
| 10 leafy veg & brassicas | lettuce, kale, spinach, rainbow chard, celery, bok choy, cauliflower |
| 11 more veg | broccoli, Brussels sprouts, artichoke, asparagus, bell pepper, zucchini |
| 12 roots & alliums | radish, turnip, parsnip, sweet potato, garlic, leek, red shallot |
| 13 grains & field | rice paddy (flooded mound), barley, oats, soybean, cotton, sugarcane, hops (on a pole) |
| 14 vines & trellis | grapes (T-trellis), peas (twig frame), cucumber (A-frame), cantaloupe, watermelon, kiwi (pergola) |
| 15 berry bushes | blueberry (tall), raspberry (canes), gooseberry (wide), redcurrant, blackcurrant (vase) |
| 16–17 fruit trees | pear, cherry, peach, lemon, orange, plum, olive, avocado, banana, coconut palm |
| 18 herbs | basil, mint, lavender, rosemary, parsley, chives |
| 19 flowers | tulip, rose, red sunflower, teddy-bear sunflower, marigold |
| 20 exotic & fun | coffee, cacao (tree), tea bush, pineapple, dragonfruit (post + ring), chili, mushroom log, cranberry bog (flooded for harvest) |

Trellises, poles, pergolas, logs and flooded tops are part of every stage of their crop, so the footprint never changes.

## 7. Hand tools & containers (`machines.py`, board 21)

- **Tools:** hoe, rake, shovel, pitchfork, sickle, scythe, shears, walk-behind rototiller. Long tools are about kid height.
- **Watering cans:** sage, galvanised metal, toy.
- **Containers:** metal bucket, wooden bucket of water, burlap grain sack, flour sack.
- **Seed bags:** pumpkin, carrot, tomato, corn, flower. Each has a picture of the crop on the front.

## 8. Modular tractor (board 22)

A tractor is **chassis + body + wheel set + paint + front attachment**.

- **Chassis:** modern bonnet, or vintage round bonnet. Both have rear fenders, a seat, a steering wheel and a hitch ring.
- **Bodies:** open with a roll bar, cab (opaque window panels, no glass), striped sun canopy, vintage (no frame).
- **Wheels:** these are the Bolt-On Racers `rk.wheel` kit, so tyres match that pack. The sets are big knobbly rears with small knobbly fronts, or turf (slick) tyres.
- **Paint:** red, green, blue, orange, yellow.
- **Attachment:** front loader bucket.

## 9. Implements & vehicles (board 23)

- **Implements:** plough, seeder, sprayer, hay baler (drops a bale), wagon (empty, hay, pumpkins). They all share the drawbar ring that hitches to the tractor.
- **Vehicles:** combine harvester (reel header, cab, unloading auger), farm pickup (loaded or empty), quad bike in two paints.

## 10. Farm structures (`structures.py`, board 24)

- **Big:** barn (gambrel roof, X doors, hayloft, weathervane), silo, wind pump with trough, water tower.
- **Medium:** shed, greenhouse, chicken coop (ramp and nest box), farm stand. The greenhouse is an **open white frame with no glass or transparent panels**: raised beds show inside, and a rolled shade cloth sits on one roof slope.
- **Small:** compost bin, beehive with bees (no faces), picket fence, picket gate, stone wall, flowering hedge.

## 11. Farmer kids: the Boo Brigade kit (`farmers.py`, boards 25–26)

The kids are the real Boo Brigade kids. `farmers.py` imports `tools/run-costume-kids/concepts/wardrobe.py` and calls its own `dress(look)`. New items are **registered into its `ITEMS` catalogue at runtime**, and nothing in the kit is edited. They use the kit's channel and colourway format, so they would export the same way as the existing pieces.

- **Hats:** straw-hat, sun-bonnet, farm-cap, head-bandana. All follow the kit's `HAT_Z` and cut the hair under them.
- **Tops:** plaid-shirt, apron. The apron is an outer layer and hides the overalls bib.
- **Bottoms:** shortalls, patched-dungarees. Both carry an overalls bib.
- **Shoes and hands:** gumboots, work-gloves.
- **Neck:** the existing bandana, in farm colourways.
- **Held props:** hoe, pitchfork, veg-basket, egg-basket, farm-can, carrot-bunch. They are kit-sized for the mitts and lean out to the side, clear of the head.
- **Ten farmer looks:** Sunny, Hank, Clover, Rowan, Poppy, Ozzie, Marigold, Basil, Daisy, Woody. The looks vary skin tone; per-kid skin is recoloured on that kid's own objects.

At Harvest scale a kid is `KS = 0.33`, about 1.37 tall. Board 26 shows kids hoeing, picking apples, watering, pulling carrots, collecting eggs, beside a tractor, with a wagon crew, and in a scale lineup with crops, a tractor and the barn.
