# Third-Party Notices — Layout Manager

When third-party software, assets, or other materials are added to Layout
Manager, they are listed here with their license and attribution requirements.

## npm dependencies

No third-party source code is vendored into this sub-project. The following
libraries are declared in `package.json` and fetched from the npm registry at
install time:

| Package | License |
| --- | --- |
| react / react-dom | MIT |
| gifenc | MIT |
| @jsquash/oxipng | Apache-2.0 |
| lucide-react | ISC |
| @series-inc/rundot-game-sdk | Series Inc. (first-party) |

Dev dependencies (Vite, TypeScript, Prettier, etc.) are standard MIT/Apache
tooling; see `package-lock.json` for the full tree.

## Google Fonts

The text tool can load fonts at runtime from the Google Fonts service. Fonts
served there are licensed under the SIL Open Font License or Apache-2.0; no
font files are bundled in this repository.

## ComfyUI workflows

The JSON files under `comfy-workflows/` and `comfy-workflows_source/` are
original workflow definitions. They reference custom nodes (e.g.
[ComfyUI-RMBG](https://github.com/1038lab/ComfyUI-RMBG)) and model checkpoints
(e.g. FLUX.2 Klein, BiRefNet) that are **not** included here — users install
those into their own ComfyUI installation and are responsible for complying
with each project's license.

## Design references

PureRef and the open-source [AnimRef](https://github.com/lettucegoblin/AnimRef)
project were studied as UI/UX references (see `PROJECT_NOTES.md`). No code or
assets from either project are included.

## Images

The banner, thumbnail, icon, and sample images under `public/` are original
Series Inc. assets created for this project.
