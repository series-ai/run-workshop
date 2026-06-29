import type { BuiltInUiRendererVariantId } from '../types'
import { arcadeCasualRendererManifest } from './graphical/arcade-casual/manifest'
import { cozyCasualRendererManifest } from './graphical/cozy-casual/manifest'
import { evergroveRendererManifest } from './graphical/evergrove/manifest'
import { industrialScifiRendererManifest } from './graphical/industrial-scifi/manifest'
import { neonScifiRendererManifest } from './graphical/neon-scifi/manifest'
import { ornateFantasyRendererManifest } from './graphical/ornate-fantasy/manifest'
import { editorialNarrativeRendererManifest } from './html/editorial-narrative/manifest'
import { neutralBaseRendererManifest } from './html/neutral-base/manifest'
import type { UiRendererArtProfile, UiRendererSelectionProfile, UiThemeDefinition } from './types'

export interface BuiltInUiRendererCatalogEntry {
  displayOrder: number
  manifest: UiThemeDefinition
  sourceDir: string
  selection: UiRendererSelectionProfile
  artProfile: UiRendererArtProfile
}

export const BUILTIN_UI_RENDERER_CATALOG: readonly BuiltInUiRendererCatalogEntry[] = [
  {
    displayOrder: 10,
    manifest: neutralBaseRendererManifest,
    sourceDir: 'renderers/html/neutral-base',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'shared',
      ticketShells: 'shared',
      iconFrameShells: 'none',
      inspectorTone: 'light',
    },
    selection: {
      designFamilyId: 'baseline',
      designFamilyLabel: 'Baseline',
      selectionSummary:
        'Best default when the brief is broad, mixed-genre, or still evolving and the pipeline needs a reliable semantic starting point.',
      bestFor: [
        'prototype or first-pass production builds',
        'systems-heavy games that need neutral chrome',
        'projects likely to lean on overrides.css for final tuning',
      ],
      avoidFor: [
        'highly specific fantasy worldbuilding',
        'cozy tabletop materiality',
        'strong cyberpunk or industrial art direction',
      ],
      keywords: ['baseline', 'flexible', 'neutral', 'generalist', 'systems', 'utility', 'prototype', 'genre-neutral'],
      avoidKeywords: ['fantasy', 'ornate', 'tabletop', 'cozy', 'neon', 'cyberpunk'],
    },
  },
  {
    displayOrder: 15,
    manifest: editorialNarrativeRendererManifest,
    sourceDir: 'renderers/html/editorial-narrative',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'shared',
      ticketShells: 'shared',
      iconFrameShells: 'none',
      inspectorTone: 'light',
    },
    selection: {
      designFamilyId: 'baseline',
      designFamilyLabel: 'Baseline',
      selectionSummary:
        'Best when the product needs a light editorial UI with messenger-like clarity, serif hierarchy, and restrained chrome for text-heavy play.',
      bestFor: [
        'chat-led, narrative, or relationship-driven products',
        'genre-neutral story worlds that should not lock to fantasy or sci-fi chrome',
        'light-theme interfaces that need premium typography more than heavy shell art',
      ],
      avoidFor: [
        'juicy arcade reward loops that need loud buttons and toy-like depth',
        'ceremonial fantasy shells with authored SVG ornament',
        'industrial or cyberpunk dashboards that need harder geometry',
      ],
      keywords: ['editorial', 'narrative', 'story', 'chat', 'messenger', 'light', 'reading', 'serif', 'premium'],
      avoidKeywords: ['arcade', 'ornate', 'ceremonial', 'industrial', 'cyberpunk', 'military'],
    },
  },
  {
    displayOrder: 20,
    manifest: cozyCasualRendererManifest,
    sourceDir: 'renderers/graphical/cozy-casual',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'shared',
      ticketShells: 'shared',
      iconFrameShells: 'none',
      inspectorTone: 'dark',
    },
    selection: {
      designFamilyId: 'casual',
      designFamilyLabel: 'Casual',
      selectionSummary:
        'Best when the game needs a warm, approachable casual skin with tabletop cues and a calmer emotional tone.',
      bestFor: [
        'cozy word and puzzle games',
        'daily ritual loops with soft progression',
        'tabletop-inspired boards, cards, and collection screens',
      ],
      avoidFor: [
        'hard-edged sci-fi or industrial settings',
        'loud arcade spectacle',
        'grim or militaristic product tone',
      ],
      keywords: ['cozy', 'tabletop', 'warm', 'paper', 'word', 'puzzle', 'calm', 'friendly', 'soft'],
      avoidKeywords: ['cyberpunk', 'industrial', 'military', 'grim', 'arcade'],
    },
  },
  {
    displayOrder: 30,
    manifest: arcadeCasualRendererManifest,
    sourceDir: 'renderers/graphical/arcade-casual',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'shared',
      ticketShells: 'shared',
      iconFrameShells: 'none',
      inspectorTone: 'light',
    },
    selection: {
      designFamilyId: 'casual',
      designFamilyLabel: 'Casual',
      selectionSummary:
        'Best when the game needs high-energy casual readability, punchy CTAs, and cheerful store or upgrade surfaces.',
      bestFor: [
        'fast-session casual loops',
        'family-friendly progression and reward beats',
        'upgrade-heavy menus that need bright contrast and obvious call-to-action hierarchy',
      ],
      avoidFor: [
        'ceremonial fantasy worlds',
        'serious tactical dashboards',
        'quiet cozy games that want softer material language',
      ],
      keywords: ['arcade', 'bright', 'playful', 'family', 'kids', 'juicy', 'energetic', 'toy-like', 'high-contrast'],
      avoidKeywords: ['ornate', 'grim', 'tactical', 'ceremonial', 'muted'],
    },
  },
  {
    displayOrder: 40,
    manifest: evergroveRendererManifest,
    sourceDir: 'renderers/graphical/evergrove',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'shared',
      ticketShells: 'shared',
      iconFrameShells: 'none',
      inspectorTone: 'dark',
    },
    selection: {
      designFamilyId: 'casual',
      designFamilyLabel: 'Casual',
      selectionSummary:
        'Best when the product wants farm-and-forest warmth with bold rounded typography, nature-driven color, and friendly toy-like contrast.',
      bestFor: [
        'farming, merge, and crafting loops with cozy outdoor themes',
        'collection screens that benefit from nature-forward warmth',
        'games that want a playful premium casual look without paper textures',
      ],
      avoidFor: [
        'hard sci-fi or industrial dashboards',
        'ceremonial fantasy shells with ornate metalwork',
        'minimal neutral admin-style interfaces',
      ],
      keywords: ['cozy', 'nature', 'farm', 'garden', 'forest', 'merge', 'bright', 'friendly', 'playful'],
      avoidKeywords: ['industrial', 'cyberpunk', 'military', 'grim', 'minimal'],
    },
  },
  {
    displayOrder: 50,
    manifest: ornateFantasyRendererManifest,
    sourceDir: 'renderers/graphical/ornate-fantasy',
    artProfile: {
      componentShells: 'fantasy',
      headerShells: 'fantasy',
      ticketShells: 'fantasy',
      iconFrameShells: 'fantasy',
      inspectorTone: 'light',
    },
    selection: {
      designFamilyId: 'fantasy',
      designFamilyLabel: 'Fantasy',
      selectionSummary:
        'Best when the UI should feel ceremonial, premium, and world-authored rather than generic app chrome.',
      bestFor: [
        'RPG and quest progression surfaces',
        'hero cards, reward ceremonies, and map-based campaigns',
        'medieval, mythic, or prestige-heavy economies',
      ],
      avoidFor: [
        'modern casual toy aesthetics',
        'minimal systems dashboards',
        'industrial or cyberpunk settings',
      ],
      keywords: ['fantasy', 'ornate', 'quest', 'rpg', 'kingdom', 'heroic', 'medieval', 'mythic', 'prestige'],
      avoidKeywords: ['modern', 'minimal', 'industrial', 'arcade', 'cyberpunk'],
    },
  },
  {
    displayOrder: 60,
    manifest: neonScifiRendererManifest,
    sourceDir: 'renderers/graphical/neon-scifi',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'none',
      ticketShells: 'none',
      iconFrameShells: 'none',
      inspectorTone: 'light',
    },
    selection: {
      designFamilyId: 'sci-fi',
      designFamilyLabel: 'Sci-Fi',
      selectionSummary:
        'Best when the product brief calls for aggressive glow, futuristic motion, and a stylized cyber interface.',
      bestFor: [
        'cyberpunk or hacking fantasies',
        'futuristic action HUDs and live-event surfaces',
        'games that benefit from electric color contrast and edge-lit chrome',
      ],
      avoidFor: [
        'rustic, cozy, or paper-material interfaces',
        'grounded tactical dashboards',
        'classical fantasy settings',
      ],
      keywords: ['sci-fi', 'cyberpunk', 'neon', 'glow', 'hack', 'futuristic', 'edgy', 'electric', 'high-tech'],
      avoidKeywords: ['cozy', 'rustic', 'paper', 'medieval', 'industrial'],
    },
  },
  {
    displayOrder: 70,
    manifest: industrialScifiRendererManifest,
    sourceDir: 'renderers/graphical/industrial-scifi',
    artProfile: {
      componentShells: 'standard',
      headerShells: 'none',
      ticketShells: 'none',
      iconFrameShells: 'none',
      inspectorTone: 'dark',
    },
    selection: {
      designFamilyId: 'sci-fi',
      designFamilyLabel: 'Sci-Fi',
      selectionSummary:
        'Best when the UI should read like equipment, controls, or instrumentation with tactile depth and disciplined hierarchy.',
      bestFor: [
        'factory, crafting, and systems-management games',
        'tactical survival or expedition dashboards',
        'games that want hardware-console clarity instead of neon spectacle',
      ],
      avoidFor: [
        'soft cozy presentation',
        'storybook or ceremonial fantasy',
        'kid-focused candy-color arcade interfaces',
      ],
      keywords: ['sci-fi', 'industrial', 'tactical', 'console', 'engineering', 'factory', 'survival', 'dashboard', 'hardware'],
      avoidKeywords: ['cozy', 'storybook', 'ornate', 'candy', 'whimsical'],
    },
  },
] as const

export const BUILTIN_UI_RENDERER_SOURCE_DIRS: Readonly<Record<BuiltInUiRendererVariantId, string>> = Object.freeze(
  Object.fromEntries(
    BUILTIN_UI_RENDERER_CATALOG.map((entry) => [entry.manifest.variantId, entry.sourceDir]),
  ) as Record<BuiltInUiRendererVariantId, string>,
)
