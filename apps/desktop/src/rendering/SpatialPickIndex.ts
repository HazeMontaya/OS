import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type PickRay = {
  origin: Vector3;
  direction: Vector3;
};

export type PickEntry = {
  id: string;
  center: Vector3;
  radius: number;
};

export type PickHit = {
  id: string;
  distance: number;
};

type Bounds = {
  min: Vector3;
  max: Vector3;
};

type BvhNode = Bounds & {
  left: BvhNode | null;
  right: BvhNode | null;
  indices: number[] | null;
};

const LEAF_SIZE = 12;
const EPSILON = 1e-7;

function entryBounds(entry: PickEntry): Bounds {
  const radius = Math.max(0.001, entry.radius);
  return {
    min: new Vector3(entry.center.x - radius, entry.center.y - radius, entry.center.z - radius),
    max: new Vector3(entry.center.x + radius, entry.center.y + radius, entry.center.z + radius),
  };
}

function mergeBounds(entries: PickEntry[], indices: number[]): Bounds {
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const index of indices) {
    const bounds = entryBounds(entries[index]);
    min.x = Math.min(min.x, bounds.min.x);
    min.y = Math.min(min.y, bounds.min.y);
    min.z = Math.min(min.z, bounds.min.z);
    max.x = Math.max(max.x, bounds.max.x);
    max.y = Math.max(max.y, bounds.max.y);
    max.z = Math.max(max.z, bounds.max.z);
  }

  return { min, max };
}

function longestAxis(bounds: Bounds): 0 | 1 | 2 {
  const x = bounds.max.x - bounds.min.x;
  const y = bounds.max.y - bounds.min.y;
  const z = bounds.max.z - bounds.min.z;
  if (x >= y && x >= z) return 0;
  if (y >= z) return 1;
  return 2;
}

function component(vector: Vector3, axis: 0 | 1 | 2): number {
  if (axis === 0) return vector.x;
  if (axis === 1) return vector.y;
  return vector.z;
}

function buildNode(entries: PickEntry[], indices: number[]): BvhNode {
  const bounds = mergeBounds(entries, indices);
  if (indices.length <= LEAF_SIZE) {
    return { ...bounds, left: null, right: null, indices };
  }

  const axis = longestAxis(bounds);
  const sorted = [...indices].sort((left, right) => component(entries[left].center, axis) - component(entries[right].center, axis));
  const midpoint = Math.floor(sorted.length / 2);
  const leftIndices = sorted.slice(0, midpoint);
  const rightIndices = sorted.slice(midpoint);

  return {
    ...bounds,
    left: buildNode(entries, leftIndices),
    right: buildNode(entries, rightIndices),
    indices: null,
  };
}

function rayHitsBounds(ray: PickRay, bounds: Bounds, maxDistance: number): boolean {
  let near = 0;
  let far = maxDistance;

  const origins = [ray.origin.x, ray.origin.y, ray.origin.z];
  const directions = [ray.direction.x, ray.direction.y, ray.direction.z];
  const mins = [bounds.min.x, bounds.min.y, bounds.min.z];
  const maxs = [bounds.max.x, bounds.max.y, bounds.max.z];

  for (let axis = 0; axis < 3; axis += 1) {
    const direction = directions[axis];
    const origin = origins[axis];
    if (Math.abs(direction) < EPSILON) {
      if (origin < mins[axis] || origin > maxs[axis]) return false;
      continue;
    }

    const inverse = 1 / direction;
    let t0 = (mins[axis] - origin) * inverse;
    let t1 = (maxs[axis] - origin) * inverse;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0);
    far = Math.min(far, t1);
    if (far < near) return false;
  }

  return far >= 0;
}

function raySphereDistance(ray: PickRay, entry: PickEntry, maxDistance: number): number | null {
  const ox = ray.origin.x - entry.center.x;
  const oy = ray.origin.y - entry.center.y;
  const oz = ray.origin.z - entry.center.z;
  const dx = ray.direction.x;
  const dy = ray.direction.y;
  const dz = ray.direction.z;
  const projection = ox * dx + oy * dy + oz * dz;
  const radius = Math.max(0.001, entry.radius);
  const constant = ox * ox + oy * oy + oz * oz - radius * radius;
  const discriminant = projection * projection - constant;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  let distance = -projection - root;
  if (distance < 0) distance = -projection + root;
  if (distance < 0 || distance > maxDistance) return null;
  return distance;
}

/**
 * Immutable BVH over cognitive node pick spheres.
 *
 * The tree is rebuilt only when projection topology/layout changes. Pointer hover and click queries
 * traverse logarithmically sized bounds instead of asking Babylon to maintain hundreds of invisible
 * pick-proxy meshes. Mutable importance/confidence updates do not invalidate the tree because the
 * index uses a conservative fixed pick radius supplied by the projection.
 */
export class SpatialPickIndex {
  readonly count: number;
  private readonly entries: PickEntry[];
  private readonly root: BvhNode | null;

  constructor(entries: PickEntry[]) {
    this.entries = entries.map((entry) => ({
      id: entry.id,
      center: entry.center.clone(),
      radius: Math.max(0.001, entry.radius),
    }));
    this.count = this.entries.length;
    this.root = this.entries.length > 0
      ? buildNode(this.entries, this.entries.map((_entry, index) => index))
      : null;
  }

  pick(ray: PickRay, maxDistance = Number.POSITIVE_INFINITY): PickHit | null {
    if (!this.root) return null;

    let nearest = maxDistance;
    let hitId: string | null = null;
    const stack: BvhNode[] = [this.root];

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || !rayHitsBounds(ray, node, nearest)) continue;

      if (node.indices) {
        for (const index of node.indices) {
          const distance = raySphereDistance(ray, this.entries[index], nearest);
          if (distance === null || distance >= nearest) continue;
          nearest = distance;
          hitId = this.entries[index].id;
        }
        continue;
      }

      if (node.left) stack.push(node.left);
      if (node.right) stack.push(node.right);
    }

    return hitId ? { id: hitId, distance: nearest } : null;
  }
}
