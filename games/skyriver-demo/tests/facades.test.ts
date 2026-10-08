import { describe, expect, it } from 'vitest';

import {
  facadeFaceContains,
  fitOnNearestFacadeFace,
  facadePaneStepMask,
  facadeRectEdgeDistance,
  facadeReservationsConflict,
  type FacadeFace,
  type FacadeReservation,
} from '../src/render/facadeGeometry';

const face = (overrides: Partial<FacadeFace> = {}): FacadeFace => ({
  id: 'tower-a:face-0',
  buildingId: 'tower-a',
  side: 1,
  planeAxis: 'x',
  plane: 500,
  outward: -1,
  u0: -100,
  u1: 100,
  y0: 100,
  y1: 900,
  stepBottom: true,
  stepTop: true,
  ...overrides,
});

const reservation = (overrides: Partial<FacadeReservation> = {}): FacadeReservation => ({
  side: 1,
  buildingId: 'tower-a',
  u0: 0,
  u1: 10,
  y0: 0,
  y1: 20,
  heightM: 20,
  compositionId: 'ordinary-a',
  role: 'ordinary',
  ...overrides,
});

describe('facade geometry', () => {
  it('fits a full sign at the exact face margin and rejects narrow or vertical overruns', () => {
    expect(facadeFaceContains(face(), { u0: -96, u1: 96, y0: 104, y1: 896 })).toBe(true);
    expect(facadeFaceContains(face({ u0: -30, u1: 30 }), { u0: -27, u1: 27, y0: 200, y1: 300 })).toBe(false);
    expect(facadeFaceContains(face(), { u0: -10, u1: 10, y0: 899, y1: 950 })).toBe(false);
    expect(facadeFaceContains(face(), { u0: -10, u1: 10, y0: 103.9, y1: 200 })).toBe(false);
  });

  it('moves a step-crossing sign to the nearest full face without spanning the step', () => {
    const lower = face({ id: 'lower', u0: -80, u1: 80, y0: 100, y1: 240, stepBottom: true, stepTop: true });
    const upper = face({ id: 'upper', u0: -60, u1: 60, y0: 260, y1: 500, stepBottom: true, stepTop: false });
    const fit = fitOnNearestFacadeFace([lower, upper], 0, 260, 20, 18);
    expect(fit?.face.id).toBe('upper');
    expect(fit?.rect).toEqual({ u0: -20, u1: 20, y0: 264, y1: 300 });
    expect(facadeFaceContains(fit!.face, fit!.rect)).toBe(true);
    expect(fit?.offsetM).toBe(22);
    expect(fitOnNearestFacadeFace([face({ u0: -12, u1: 12 })], 0, 400, 10, 10)).toBeUndefined();
  });

  it('applies ordinary spacing across buildings and the loop seam on one side', () => {
    const a = reservation({ buildingId: 'lot-a', u0: 0, u1: 20, y0: 0, y1: 20, heightM: 20 });
    const exact = reservation({ buildingId: 'adjacent-lot', u0: 60, u1: 80, y0: 0, y1: 20, heightM: 20 });
    const close = { ...exact, u0: 59, u1: 79 };
    expect(facadeRectEdgeDistance(a, exact)).toBe(40);
    expect(facadeReservationsConflict(a, exact, 1000)).toBe(false);
    expect(facadeReservationsConflict(a, close, 1000)).toBe(true);

    const lapEnd = reservation({ u0: 995, u1: 1000, y0: 0, y1: 20, heightM: 20 });
    const lapStart = reservation({ u0: 0, u1: 5, y0: 0, y1: 20, heightM: 20 });
    expect(facadeRectEdgeDistance(lapEnd, lapStart, 1000)).toBe(0);
    expect(facadeReservationsConflict(lapEnd, lapStart, 1000)).toBe(true);
    expect(facadeReservationsConflict(a, { ...close, side: -1 }, 1000)).toBe(false);
  });

  it('keeps ordinary signs clear of hero unions and permits a planned hero row', () => {
    const heroUnion = reservation({ role: 'hero', compositionId: 'hero-row-1', u0: 0, u1: 100, y0: 0, y1: 400, heightM: 400 });
    const exact = reservation({ u0: 0, u1: 100, y0: 1000, y1: 1020, heightM: 20 });
    const close = { ...exact, y0: 999, y1: 1019 };
    expect(facadeRectEdgeDistance(heroUnion, exact)).toBe(600);
    expect(facadeReservationsConflict(heroUnion, exact, 1000)).toBe(false);
    expect(facadeReservationsConflict(heroUnion, close, 1000)).toBe(true);
    expect(facadeReservationsConflict(heroUnion, { ...heroUnion, u0: 20, u1: 30 }, 1000)).toBe(false);
  });

  it('exempts only blades in one planned row and spaces different hero compositions', () => {
    const rowBlade = reservation({ role: 'hero', compositionId: 'hero-row-1', u0: 0, u1: 6, y0: 0, y1: 400, heightM: 400 });
    const sameRowBlade = { ...rowBlade, u0: 38, u1: 44 };
    const standalone = reservation({ role: 'hero', compositionId: 'hero-panel-1', u0: 0, u1: 20, y0: 600, y1: 650, heightM: 50 });
    const tooClose = { ...standalone, compositionId: 'hero-panel-2', u0: 0, u1: 20, y0: 599, y1: 649 };
    const exact = { ...standalone, compositionId: 'hero-panel-2', u0: 620, u1: 640, y0: 1000, y1: 1050 };
    expect(facadeReservationsConflict(rowBlade, sameRowBlade, 1000)).toBe(false);
    expect(facadeReservationsConflict(rowBlade, standalone, 1000)).toBe(true);
    expect(facadeReservationsConflict(standalone, tooClose, 1000)).toBe(true);
    expect(facadeReservationsConflict(rowBlade, exact, 1000)).toBe(false);
  });

  it('masks whole pane cells at step edges and keeps clear cells', () => {
    expect(facadePaneStepMask(50, -10, 5, true, true)).toBe(0);
    expect(facadePaneStepMask(50, -8, 5, true, true)).toBe(0);
    expect(facadePaneStepMask(50, -7, 5, true, true)).toBe(1);
    expect(facadePaneStepMask(50, 6, 5, true, true)).toBe(1);
    expect(facadePaneStepMask(50, 8, 5, true, true)).toBe(0);
    expect(facadePaneStepMask(50, 9, 5, true, true)).toBe(0);
    expect(facadePaneStepMask(50, -10, 5, false, false)).toBe(1);
    expect(facadePaneStepMask(800, 86, 9, false, true)).toBe(1);
    expect(facadePaneStepMask(800, 87, 9, false, true)).toBe(0);
  });
});
