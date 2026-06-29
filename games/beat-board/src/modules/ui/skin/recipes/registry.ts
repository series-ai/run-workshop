import { SEMANTIC_UI_COMPONENTS } from '../semanticComponents'
import { SEMANTIC_APPROVAL_VARIANTS } from '../semanticApproval'
import { usesFantasyRendererShells } from '../renderers/traits'
import type { SemanticComponentRecipe, SemanticRecipeRegistry } from './schema'

function inferStrategy(componentName: string, rendererFamily: 'html' | 'graphical'): SemanticComponentRecipe['strategy'] {
  if (rendererFamily === 'html') {
    return 'css-only'
  }

  if (
    componentName.startsWith('Panel.')
    || componentName === 'Input.Text'
    || componentName === 'Input.Textarea'
    || componentName === 'ProgressBar'
    || componentName === 'Slider'
  ) {
    return 'border-image'
  }

  if (componentName === 'Header' || componentName === 'IconFrame') {
    return 'layered-artboard'
  }

  return 'hybrid'
}

function inferCssModulePath(componentName: string): string {
  if (componentName.startsWith('Button.')) {
    return 'renderers/shared/styles/buttons.css'
  }
  if (componentName.startsWith('Panel.')) {
    return 'renderers/shared/styles/panels.css'
  }
  if (componentName.startsWith('Input.') || componentName === 'Checkbox' || componentName === 'Radio' || componentName === 'Switch') {
    return 'renderers/shared/styles/inputs.css'
  }
  if (componentName === 'ProgressBar' || componentName === 'Slider') {
    return 'renderers/shared/styles/progress.css'
  }
  if (componentName === 'Tabs' || componentName === 'NavRail' || componentName === 'PaginationDots') {
    return 'renderers/shared/styles/navigation.css'
  }
  return 'renderers/shared/styles/base.css'
}

function getRendererThemePath(_rendererVariantId: string): string {
  return 'renderers/active/theme.css'
}

function inferSourceAssetPaths(componentName: string, rendererVariantId: string, _state: string): string[] {
  const paths = [getRendererThemePath(rendererVariantId)]

  if (usesFantasyRendererShells(rendererVariantId)) {
    if (componentName === 'Header') {
      paths.push('renderers/active/hero-plaque-shell.svg')
    }

    if (componentName === 'Header.Ribbon') {
      paths.push('renderers/active/hero-ribbon-shell.svg')
    }

    if (
      componentName === 'Button.Primary'
      || componentName === 'Button.Secondary'
      || componentName === 'Button.Pill'
      || componentName === 'Button.Stacked'
      || componentName === 'Button.TrailingVisual'
      || componentName === 'Button.LeadingVisual'
      || componentName === 'Button.Currency'
    ) {
      paths.push('renderers/active/hero-plaque-shell.svg')
    }

    if (
      componentName === 'Panel.Card'
      || componentName === 'Panel.Section'
      || componentName === 'Panel.Modal'
      || componentName === 'Panel.Sheet'
      || componentName === 'Panel.Popover'
      || componentName === 'Dialog.Confirmation'
      || componentName === 'Dialog.Reward'
      || componentName === 'Settings.Section'
      || componentName === 'State.Empty'
      || componentName === 'State.Loading'
      || componentName === 'State.Error'
      || componentName === 'Ftue.StepCard'
      || componentName === 'Ftue.Callout'
      || componentName === 'Ftue.GateBanner'
      || componentName === 'Input.Text'
      || componentName === 'Input.Textarea'
      || componentName === 'Input.Select'
      || componentName === 'Button.Ghost'
      || componentName === 'Button.Grid'
      || componentName === 'NavRail'
    ) {
      paths.push('renderers/active/plaque-shell.svg')
    }

    if (componentName === 'Button.Tab' || componentName === 'Tabs') {
      paths.push('renderers/active/tab-shell.svg')
    }

    if (
      componentName === 'Button.Icon'
      || componentName === 'Button.Close'
      || componentName === 'Button.Back'
      || componentName === 'IconFrame'
      || componentName === 'Badge.Counter'
      || componentName === 'Badge.New'
      || componentName === 'Chip.Currency'
      || componentName === 'Chip.Value'
    ) {
      paths.push('renderers/active/medallion-shell.svg')
    }

    if (componentName === 'ProgressBar' || componentName === 'Slider') {
      paths.push('renderers/active/track-shell.svg')
    }

    if (componentName === 'Ticket') {
      paths.push('renderers/active/ticket-shell.svg')
    }

    return paths
  }

  if (componentName === 'Header' || componentName === 'Header.Ribbon') {
    paths.push('theme/svg/header-ribbon-wings.svg')
  }

  if (componentName === 'Ticket') {
    paths.push('theme/svg/ticket-shell.svg')
  }

  return paths
}

export const SEMANTIC_COMPONENT_RECIPE_REGISTRY: SemanticRecipeRegistry = {
  generatedAt: new Date('2026-03-22T00:00:00.000Z').toISOString(),
  recipes: SEMANTIC_APPROVAL_VARIANTS.flatMap((variant) =>
    SEMANTIC_UI_COMPONENTS.map<SemanticComponentRecipe>((component) => ({
      componentName: component.name,
      rendererVariantId: variant.id,
      rendererFamily: variant.family,
      strategy: inferStrategy(component.name, variant.family),
      anatomyId: `${variant.id}:${component.name}`,
      cssModulePath: inferCssModulePath(component.name),
      states: component.states.map((state) => ({
        state,
        sourceAssetPaths: inferSourceAssetPaths(component.name, variant.id, state),
        width: null,
        height: null,
        notes: [],
      })),
    })),
  ),
}

export function getSemanticComponentRecipe(componentName: string, rendererVariantId: string): SemanticComponentRecipe | undefined {
  return SEMANTIC_COMPONENT_RECIPE_REGISTRY.recipes.find(
    (recipe) => recipe.componentName === componentName && recipe.rendererVariantId === rendererVariantId,
  )
}
