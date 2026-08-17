import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { BurgerShopEffect, getBurgerShopRecipe } from '../../src/burger-shop/BurgerShopEffect'
import {
  BURGER_SHOP_RECIPES,
  nextBurgerShopRecipeId,
  previousBurgerShopRecipeId,
} from '../../src/burger-shop/recipes'

function CameraRig({
  position,
  target,
}: {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}) {
  const { camera } = useThree()
  useLayoutEffect(() => {
    camera.position.set(position[0], position[1], position[2])
    camera.lookAt(target[0], target[1], target[2])
    camera.updateProjectionMatrix()
  }, [camera, position, target])
  return null
}

export function readBurgerShopRequestedId(search = window.location.search): string {
  const requested = new URLSearchParams(search).get('id')
  if (requested && BURGER_SHOP_RECIPES.some((recipe) => recipe.id === requested)) return requested
  return BURGER_SHOP_RECIPES[0].id
}

export function BurgerShopPreview() {
  const [effectId, setEffectId] = useState(readBurgerShopRequestedId)
  const [playKey, setPlayKey] = useState(0)
  const recipe = useMemo(() => getBurgerShopRecipe(effectId), [effectId])
  const index = BURGER_SHOP_RECIPES.findIndex((entry) => entry.id === effectId)

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('id', effectId)
    window.history.replaceState({}, '', url)
  }, [effectId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setEffectId((current) => nextBurgerShopRecipeId(current))
        setPlayKey((value) => value + 1)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setEffectId((current) => previousBurgerShopRecipeId(current))
        setPlayKey((value) => value + 1)
      }
      if (event.key === ' ' || event.key === 'r' || event.key === 'R') {
        event.preventDefault()
        setPlayKey((value) => value + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const camera = useMemo(() => {
    if (effectId === 'sunshine') return { position: [0.2, 1.6, 5.8] as const, target: [0, 1.1, 0] as const, fov: 40 }
    if (effectId === 'storefront') return { position: [3.4, 3.8, 8.2] as const, target: [0.4, 2.2, 0] as const, fov: 42 }
    if (effectId === 'smoke') return { position: [1.8, 1.8, 3.0] as const, target: [0, 1.1, 0] as const, fov: 40 }
    if (effectId === 'flies') return { position: [1.2, 0.95, 1.8] as const, target: [0, 0.4, 0] as const, fov: 36 }
    if (effectId === 'confetti-02') return { position: [1.15, 0.85, 1.85] as const, target: [0, 0.2, 0] as const, fov: 36 }
    if (effectId === 'eating') return { position: [0.85, 0.5, 1.25] as const, target: [0, 0.18, 0] as const, fov: 34 }
    if (effectId === 'character-upgrade' || effectId === 'unlock-area') {
      return { position: [2.4, 2.2, 3.8] as const, target: [0, 1.3, 0] as const, fov: 40 }
    }
    if (effectId === 'character-footsteps') return { position: [1.9, 1.2, 2.9] as const, target: [0, 0.25, 0] as const, fov: 42 }
    return { position: [1.8, 1.3, 3.0] as const, target: [0, 0.4, 0] as const, fov: 40 }
  }, [effectId])

  const selectEffect = (id: string) => {
    setEffectId(id)
    setPlayKey((value) => value + 1)
  }

  return (
    <div className="burger-review">
      <header className="burger-review-bar">
        <div className="burger-review-title">
          <strong>{recipe.label}</strong>
          <span>
            {index + 1}/{BURGER_SHOP_RECIPES.length} · {recipe.unityPrefab}
          </span>
        </div>
        <div className="burger-review-actions">
          <button type="button" onClick={() => selectEffect(previousBurgerShopRecipeId(effectId))}>
            Prev
          </button>
          <button type="button" onClick={() => setPlayKey((value) => value + 1)}>
            Replay
          </button>
          <button type="button" onClick={() => selectEffect(nextBurgerShopRecipeId(effectId))}>
            Next
          </button>
        </div>
        <nav className="burger-review-nav" aria-label="BurgerTime effects">
          {BURGER_SHOP_RECIPES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === effectId ? 'is-active' : undefined}
              onClick={() => selectEffect(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="burger-review-stage">
      <Canvas camera={{ position: [...camera.position], fov: camera.fov, near: 0.05, far: 40 }}>
        <CameraRig position={camera.position} target={camera.target} />
        <color attach="background" args={['#1a2230']} />
        <hemisphereLight args={['#f0e6d4', '#1a2230', 1.2]} />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff7e8" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[5, 48]} />
          <meshStandardMaterial color="#d7c4a3" roughness={0.86} metalness={0.08} />
        </mesh>
        <gridHelper args={[6, 12, '#4b5b72', '#334155']} position={[0, 0.001, 0]} />
        <BurgerShopEffect key={`${effectId}-${playKey}`} recipe={recipe} />
      </Canvas>
      </div>
    </div>
  )
}
