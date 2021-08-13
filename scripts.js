import 'regenerator-runtime/runtime';

import { select, selectAll } from 'd3-selection';
import { json } from 'd3-fetch';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { format } from 'd3-format';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';

const d3 = Object.assign(
  {},
  {
    select,
    selectAll,
    json,
    sankey,
    sankeyLinkHorizontal,
    format,
    scaleOrdinal,
    schemeCategory10,
    rgb
  }
);

const jsonUrl = `https://gist.githubusercontent.com/tekd/e9d8aee9e059f773aaf52f1130f98c65/raw/4a2af7014f0a8eed1a384f9d3f478fef6f67b218/sankey-test.json`;

/*
  SET UP GRAPH DIMENSIONS
*/

const margin = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10
};

const width = 900;
const height = 300;

/*
  FORMATTING HELPERS
*/

const formatSetting = d3.format('.0f');
const formatNumber = (d) => formatSetting(d);
const color = d3.scaleOrdinal(schemeCategory10);

/*
  APPEND SVG TO PAGE
*/

let svg = d3
  .select('body')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

/*
  SETUP SANKEY PROPERTIES
*/

let sankeyGraph = d3
  .sankey()
  .nodeWidth(36)
  .nodePadding(40)
  .size([width, height]);

let path = sankeyGraph.links();

/*
  LOAD DATA
*/

d3.json(jsonUrl).then((data) => {
  let graph = sankeyGraph(data);
  console.log(graph);

  /* ADD LINKs */
  let link = svg
    .append('g')
    .selectAll('.link')
    .data(graph.links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke-width', (d) => d.width);

  /* ADD LINK TITLES: currently only showing on hover tooltip*/
  link.append('title').text((d) => {
    console.log(d);
    return `${d.source.name} → ${d.target.name} \n ${format(d.value)}`;
  });

  /* ADD NODES */
  let node = svg
    .append('g')
    .selectAll('.node')
    .data(graph.nodes)
    .enter()
    .append('g')
    .attr('class', 'node');

  /* ADD NODE RECTANGLES */
  node
    .append('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('height', (d) => d.y1 - d.y0)
    .attr('width', sankeyGraph.nodeWidth())
    .style('fill', (d) => {
      return (d.color = color(d.name.replace(/ .*/, '')));
    })
    .style('stroke', (d) => d3.rgb(d.color).darker(2))
    .append('title')
    .text((d) => `${d.name} \n ${format(d.value)}`);

  /* ADD NODE TITLES */
  node
    .append('text')
    .attr('x', (d) => d.x0 - 6)
    .attr('y', (d) => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .text((d) => d.name)
    .filter((d) => d.x0 < width / 2)
    .attr('x', (d) => d.x1 + 6)
    .attr('text-anchor', 'start');
});
