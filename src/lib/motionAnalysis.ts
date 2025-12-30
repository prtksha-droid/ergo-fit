type Point = { x: number; y: number };

type MotionState = {
  prev?: Point;
  velocity?: number;
  acceleration?: number;
};

const motionMap = new Map<string, MotionState>();

export function updateMotion(
  key: string,
  curr: Point,
  dt: number
) {
  const state = motionMap.get(key) ?? {};
  let velocity = 0;
  let acceleration = 0;

  if (state.prev && dt > 0) {
    const dx = curr.x - state.prev.x;
    const dy = curr.y - state.prev.y;
    velocity = Math.sqrt(dx * dx + dy * dy) / dt;

    if (state.velocity !== undefined) {
      acceleration = (velocity - state.velocity) / dt;
    }
  }

  motionMap.set(key, { prev: curr, velocity, acceleration });
  return { velocity, acceleration };
}
