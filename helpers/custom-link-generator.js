import { linkHorizontal } from 'd3-shape';

export let customLinkGenerator = linkHorizontal()
  .x((d) => d.x1)
  .y((d) => d.y0);

export let customLinkGenerator2 = linkHorizontal()
  .x((d) => d.x1)
  .y((d) => d.y0 + 3.5);
