type Point = {x: number; y: number};

/** Decorative group membership, not dependencies or execution relationships. */
export function constellationLinks(points: Point[]) {
  return points.slice(1).map((point, index) => {
    let nearest = 0;
    for (let i = 1; i <= index; i++) {
      const distance = (p: Point) => (p.x-point.x)**2+(p.y-point.y)**2;
      if (distance(points[i]) < distance(points[nearest])) nearest = i;
    }
    return {a: points[nearest], b: point, id: `${nearest}/${index+1}`};
  });
}
