Two reusable header SVG templates live in this folder:

- `header-banner-notch.svg`
  - centered banner with bottom notch
  - good for title + subtitle blocks like the blue/purple examples
- `header-ribbon-wings.svg`
  - straight ribbon with side wings
  - good for louder reward / section headers like the green/orange/yellow examples

Recommended use:

1. `background-image`
   - use the SVG as the header shell and place text in normal HTML over it
2. inline `<img>`
   - simplest if the text remains separate
3. inline SVG in React
   - best if you want to recolor stops or add embedded decoration

Fast customization targets inside the files:

- main body gradient stops
- stroke color
- shadow/base layer color
- highlight stop opacity

These are template assets, not final themed runtime bindings yet.
