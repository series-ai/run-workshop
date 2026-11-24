# Pots

Pots are the monster's torso and a collectible. Every pot is built in code (`src/body/pots.ts`): a turned profile plus
extras (feet, handles, hoops, saucer), with **colourways** (body / accent / rim) and an optional two-colour **pattern
layer** on the body, the same idea as the leaves. Legs and arms (`src/body/limbs.ts`) fit any pot from its shape.

Preview:
- All pots: `http://localhost:5321/?debug=pots` (colourway buttons switch the whole wall)
- On a plant / as a monster: `http://localhost:5321/?plant=monstera&pot=classic&cw=0&body=1` (pot picker, colourways,
  body toggle and skin colour in the panel)

✅ = built. Everything else is a backlog idea that fits the same builder.

## Everyday (common)

| Pot | Shape | Colourways |
| --- | --- | --- |
| ✅ Classic Pot | kit terracotta taper + rolled collar | Terracotta, Whitewash, Aged moss, Dipped rim, Charcoal |
| ✅ Azalea Pot | short, wide classic | same as Classic |
| ✅ Stepped Sage | stacked bands (concept lineup) | Sage, Butter, Sky, Ink |
| ✅ Glossy Cylinder | soft straight glazed pot (concept lineup) | Peach, Cream, Cobalt, Mint, Lilac |
| ✅ Speckled Stone | rounded stoneware with speckles (concept lineup) | Oat, Charcoal, Blush |
| ✅ Low Bowl | wide succulent bowl (concept lineup) | Taupe, Slate, Sand |
| ✅ Woven Basket | rattan basket (concept lineup) | Rattan, Seagrass, Two-tone |
| Nursery Pot | thin black plastic with a ribbed rim (the "starter" pot) | Black, Green, Terracotta plastic |
| Long Tom | tall narrow terracotta | Terracotta, Whitewash |
| Square Cement | heavy square concrete | Cement, Charcoal |

## Shapes (uncommon)

| Pot | Shape | Colourways |
| --- | --- | --- |
| ✅ Terrazzo Planter | straight cylinder, chip pattern | Classic, Green chip, Dark |
| ✅ Pot Belly | round belly, flared neck | Celadon, Honey, Oxblood |
| ✅ Egg Pot | egg with the top cut off | Eggshell, Speckled egg, Robin |
| ✅ Tulip Flare | narrow foot, wide trumpet | Coral, Teal, Mustard |
| ✅ Fluted Pot | vertical flutes | Milk, Pistachio, Rose |
| ✅ Ribbed Planter | horizontal ribs | Clay, Black, Seafoam |
| ✅ Hex Geo | 6-sided | Concrete, White, Copper |
| ✅ Faceted Gem | 8-sided double cone | Amethyst, Emerald, Ruby, Gold |
| ✅ Square Box | 4-sided modern | Cement, Black, Painted blue |
| ✅ Pinstripe Tall | tall cylinder, fine vertical lines | Graphite, Paper |
| Bulb Vase | sphere with a tiny neck | Glass green, Amber |
| Hourglass | pinched waist | Sand, Ink |
| Bell | bell curve, flat lip | Bronze, Verdigris |
| Lantern | 4-sided with a peaked top band | Rust, Black |
| Pumpkin | ribbed round squash | Orange, White, Green |

## Patterns (uncommon)

| Pot | Pattern | Colourways |
| --- | --- | --- |
| ✅ Beach Stripe | horizontal stripes | Sailor, Candy, Lime |
| ✅ Polka Pot | dots on a collared pot | Cherry, Sunny, Night |
| ✅ Drip Glaze | glaze poured from the rim | Ocean, Honey, Matcha |
| ✅ Checkerboard | checks | Retro, Peachy, Lilac |
| ✅ Wavy Squiggle | three wavy lines | Lagoon, Sunset, Grape |
| ✅ Sweetheart | hearts | Valentine, Cream |
| ✅ Crackle Glaze | crazed lines | Celadon, Ivory |
| ✅ Harlequin | diamonds | Jester, Teal |
| ✅ Party Confetti | sprinkles | Birthday, Neon |
| Gingham | woven checks | Picnic red, Blue |
| Leopard | spots with rings | Classic, Pink |
| Cow | big black patches | Holstein, Highland brown |
| Flowers | five-petal daisies | Meadow, Pastel |
| Sunburst | rays from the base | Gold, Coral |
| Moon & stars | crescent and stars | Night, Dusk |
| Mosaic | broken tiles | Azulejo blue, Majolica |

## Found objects (rare)

| Pot | Shape | Colourways |
| --- | --- | --- |
| ✅ Wooden Crate | 4 planks | Pine, Weathered, Painted |
| ✅ Half Barrel | bulged staves, two hoops | Oak, Whiskey, Silver birch |
| ✅ Tin Bucket | taper, two hoops, wire handle | Galvanised, Red enamel, Rust |
| ✅ Tin Can | ribbed can with a label | Tomato, Beans, Peaches |
| ✅ Teacup | cup + handle, dots | Rosebud, Blue willow, Mint |
| ✅ Coffee Mug | mug + handle, stripes | Diner, Navy stripe, Camp enamel |
| Watering Can | can with spout and handle | Green, Galvanised |
| Rain Boot | a welly, sole and heel | Yellow, Red, Navy |
| Toy Bucket | beach bucket with a spade | Primary red, Blue |
| Paint Tin | lidded tin with drips | Any paint colour |
| Takeout Box | folded box with wire handle | White, Red |
| Snow Globe | dome on a base (plant inside) | Winter, Gold |
| Toolbox | open tray with a handle | Red metal, Wood |

## Fancy (epic)

| Pot | Shape | Colourways |
| --- | --- | --- |
| ✅ Amphora | ear handles, zigzag bands | Greek, Black figure, Sea |
| ✅ Mossy Ruin | collared stone pot, moss creeping on | Forest, Ancient |
| Gold Rim | glazed pot with a gilded collar | Black/gold, White/gold |
| Fabergé | jewelled egg with gold bands | Imperial, Rose |
| Bonsai Tray | low rectangle | Unglazed brown, Cobalt |
| Ming Vase | belly vase, blue painted swirls | Blue & white |
| Topiary Planter | square box with ball finials | Lead grey, White |

## Legendary / themed

| Pot | Shape | Colourways |
| --- | --- | --- |
| ✅ Cauldron | round iron pot, ear handles | Iron, Copper, Witchy |
| ✅ Dragon Scales | scale pattern | Jade, Fire, Mermaid |
| Treasure Chest | box with lid hinged open | Pirate, Gold |
| Rocket | finned cylinder with portholes | Retro red, Silver |
| Crown | pot with spikes and jewels | Gold, Silver |
| Robot Head | box with antenna and bolts | Tin, Mint |
| Geode | rock shell with crystal rim | Amethyst, Citrine |
| Haunted Jack | carved pumpkin | Halloween |
| Ice Bucket | frosted with ice cube rim | Frost |
| Pot of Gold | rainbow handle, coins | Lucky |

## Shape rules

- **No feet, pedestals, legs or saucers.** The monster's own legs come out of the bottom, so pots sit flat.
- **Cartoony, chunky proportions.** Thick walls with a fat rolled lip on every pot (no thin lips), soft rounded base.
- Sizes can vary: arms and legs anchor per pot (shoulders on the wall at ~55% height, hips under the base).
- Kit-style shading: a soft baked gradient (darker at the foot, lighter at the rim), matte rather than shiny.

## Colourway rules

- Two main colours per pot (body + accent), optionally a different rim. Patterns use exactly those two colours.
- Every pot ships with its "natural" colourway first; others are unlocks/shop variants.
- Skin (limb) colour is separate from the pot and can be changed per monster.
