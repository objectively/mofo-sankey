import { min, max } from 'd3-array';
import { select, selectAll } from 'd3-selection';
import { scaleSqrt, scaleOrdinal, scaleLinear } from 'd3-scale';

export function applyLinkScale(chart) {
  let maxValLinks = max(chart.links.map((link) => link.width));
  let minValLinks = min(chart.links.map((link) => link.width));
  return scaleSqrt().domain([minValLinks, maxValLinks]).range([4, 15]);
}

export function applyNodeScale(nodes) {
  let maxValNode = d3.max(Array.from(nodes).map((node) => node.__data__.value));
  let minValNode = d3.min(Array.from(nodes).map((node) => node.__data__.value));
  return scaleSqrt().domain([minValNode, maxValNode]).range([20, 30]);
}
