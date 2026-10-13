# Plant Monster Game: Design Doc

## Aesthetic

Cozy botanical, like a paper-craft terrarium. Picture a plant shop on a rainy
afternoon, with warm lamp light and earthy pots. Shapes are soft and rounded,
nothing is sharp, and the colors are muted naturals.

## Colors

- **Peach Coral `#E8836A`**: buttons and key accents (primary).
- **Foliage Sage `#7A8C6E`**: supporting accents and healthy need bars.
- **Deep Bark `#1E2918`**: the background behind all UI.
- **Moss Shadow `#2B3D24`**: panel and card fills.
- **Butter Cream `#F2EBE0`**: main text. The score and highlights use a slightly
  deeper cream, `#F2D990`.
- **Dusty Coral `#C9625F`**: warnings and critical states.
- **Soft Blush `#EBB09A`**: seedling badges.
- **Silver Mist `#DDDDD8`**: disabled states.
- Need bars go sage when healthy (above 60), butter in the warning range
  (30–60), and coral when critical (below 30).
- Age badges run from blush (seedling) to yellow-green (pup), butter (teen),
  peach (adult) and coral (elder).

## Typography

Nunito, in weights 600, 700 and 800. Labels and buttons are all caps with
letter-spacing. HUD numbers use fixed-width digits. Text over the 3D scene
always has a shadow so it stays readable.

## UI panels

Dark translucent panels with a slight blur and a faint green border. Corners
are 6px at most. Buttons are solid peach with a press-down effect and no hover
states, since the game is mobile-first.

## Monsters

- Their bodies are soft, pillow-shaped blobs with no hard edges and no eyes.
- Personality comes from body proportions, movement, a unique plant growing
  from the head, and size.
- Size by age: seedling 0.18×, pup 0.4×, teen 0.65×, adult 1.0×, elder 1.1×.
- Each monster type has its own green with an accent color: Mochi (forest
  green), Fern (garden green), Wiggly (olive with amber), Spike (dark forest
  with teal).

## World

A warm, furnished interior lit by afternoon light through two windows. The
floor is sand wood and the walls are pale petal. There is a blue water zone
where monsters drink. The camera is isometric-ish, and players can rotate and
zoom but not pan.

## Seed and planting flow

1. Tap the 🌱 button to open a 2×2 seed grid, with one card per monster type.
2. Tap a card to pick up the seed. It floats under your finger.
3. The target pot glows with a pulsing green ring.
4. Tap the glowing pot to plant. Tapping anywhere else cancels and returns the
   seed.

## Sound direction (not yet defined)

Soft vibraphone and plucks with ambient room tone, a gentle thud for planting,
a chime when a monster wakes, warm rising tones for age-up, and rustling when
needs are critical.

## Still open

- Particle effects for watering, age-up and happiness.
- Idle animations for each age stage.
- A distinct look for elders.
- Screen transitions.
- A win or game-over condition.
