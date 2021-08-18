import 'regenerator-runtime/runtime';

import { select, selectAll } from 'd3-selection';
import { csv, json } from 'd3-fetch';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { format } from 'd3-format';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import { nest } from 'd3-collection';

let issuesToEngagement = require(`./data/Copy of Data for Visualizations - Issue areas by Engagement Type.csv`);
let engagementToOutput = require(`./data/Copy of Data for Visualizations - Output Types by Engagement Type.csv`);
let programAwardsCount = require(`./data/Copy of Data for Visualizations - Programs Awards Count.csv`);

let realIssuesToEngagement = require(`./data/real/Sankey data - Moz F&A - Issue Area _ Program _ Output.csv`);
let realEngagementToOutput = require(`./data/real/Sankey data - Moz F&A - Output _ Program _ Issue Area.csv`);
let realProgramAwardsCount = require(`./data/real/Sankey data - Moz F&A - Awards Count.csv`);

const d3 = Object.assign(
  {},
  {
    csv,
    nest,
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

// const jsonUrl = `https://gist.githubusercontent.com/tekd/e9d8aee9e059f773aaf52f1130f98c65/raw/4a2af7014f0a8eed1a384f9d3f478fef6f67b218/sankey-test.json`;

/*
  SET UP GRAPH DIMENSIONS
*/

const margin = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10
};

const width = 1200;
const height = 1000;

/*
  FORMATTING HELPERS
*/

const formatSetting = d3.format('.0f');
const formatNumber = (d) => d;
const color = d3.scaleOrdinal(schemeCategory10);

// SETUP VARIABLES
let programAwards;
let realProgramAwards;
let groupCol = 'Issue Area Tags\n(pick ONE) ';
let groupEngagement = 'Engagement Type';
let groupCount = 'COUNTA of Fellow/ Award Amount \n(total, incl suppl)';
let awardsData;
let outputsData;
let outputEngagement = 'Program';
let outputPrimary = 'Issue Area Tags\n(pick ONE) ';
let outputCount = 'COUNTA of Fellow/ Award Amount \n(total, incl suppl)';

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
  .nodeWidth(30)
  .nodePadding(20)
  .size([width, height]);

let path = sankeyGraph.links();

/**
 *  ADD TOOLTIPS
 */
let tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

/* 
  FORMAT DATA
*/

Promise.all([
  // d3.csv(issuesToEngagement),
  // d3.csv(engagementToOutput),
  // d3.csv(programAwardsCount)
  d3.csv(realIssuesToEngagement),
  d3.csv(realEngagementToOutput),
  d3.csv(realProgramAwardsCount)
]) // begin
  .then((data) => {
    let graph = { nodes: [], links: [] };

    data[0].forEach((d) => {
      let sourceCol = 'Issue Area Tags\n(pick ONE) ';
      let targetCol = 'Program';
      let valueCol = 'Number of Awards'; // is this awards now

      if (d[sourceCol] === d[targetCol]) {
        // console.log(d[sourceCol]);
      }

      /**
       *  ADD PROGRAMS AND AWARDS TO ISSUES
       
       */
      realProgramAwards = d3
        .nest()
        .key((d) => d[groupCol])
        .entries(data[2]);

      graph.nodes.push({
        name: d[sourceCol],
        nodeType: 'issue'
      });

      graph.nodes.push({ name: d[targetCol] });
      graph.links.push({
        source: d[sourceCol],
        target: d[targetCol],
        value: d[valueCol]
      });
    });

    data[1].forEach((d) => {
      let sourceCol = 'Program';
      let targetCol = 'Primary Output\n(pick ONE)';
      let valueCol = ' Number of awards';
      graph.nodes.push({ name: d[sourceCol], nodeType: 'engagement' });
      graph.nodes.push({ name: d[targetCol] });
      graph.links.push({
        source: d[sourceCol],
        target: d[targetCol],
        value: d[valueCol]
      });
    });

    /*
     */
    outputsData = d3
      .nest()
      .key((d) => d['Program'])
      .key((d) => d['Primary Output\n(pick ONE)'])
      .entries(data[1]);

    let uniqueNodesStr = new Set(
      graph.nodes.map((node) => JSON.stringify(node))
    );
    // return unique nodes
    graph.nodes = Array.from(uniqueNodesStr).map((node, idx) => {
      return Object.assign({ node: idx }, JSON.parse(node));
    });

    //replace link names
    graph.links.forEach((d, i) => {
      const graphMap = graph.nodes.map((node) => node.name);
      graph.links[i].source = graphMap.indexOf(graph.links[i].source);
      graph.links[i].target = graphMap.indexOf(graph.links[i].target);
    });

    return graph;
  })
  .then((data) => {
    /* LOAD DATA */

    let chart = sankeyGraph(data);

    /* ADD LINKs */
    let link = svg
      .append('g')
      .selectAll('.link')
      .data(() => {
        return chart.links;
      })
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke-width', (d) => d.width);

    /**
     *  ADD TOOLTIPS
     */
    link
      .on('mouseover', function (mouseEvent, data) {
        let linkData = realProgramAwards.filter(
          (program) => program.key === data.source.name
        )[0];

        if (linkData) {
          awardsData = linkData.values.reduce((acc, program) => {
            return (acc += `${program['Program']} - ${program[groupCount]} Awards </br>`);
          }, ``);
        }

        let outputData = outputsData.filter(
          (output) => output.key === data.source.name
        )[0];
        let outputTypesCount;
        let outputDetail;
        if (outputData) {

          outputTypesCount = outputData && outputData.values.length;
          outputDetail = outputData.values.reduce((acc, output) => {
            return (acc += `${output.key} - ${output.values.length} </br>`);
          }, ``);
        }

        let tooltipHtml =
          data.source.nodeType === 'issue'
            ? `
              <div class="details">
              <div class="issue-title">
              ${data.source.name}
              </div>
              <div class="total-programs">
              ${linkData && linkData.values.length} Projects
              </div>
              <div class="total-awards">
              ${awardsData && awardsData}
              </div>
              </div>
              `
            : `<div class="details">
              <div class="issue-title">
              ${data.source.name}
              </div>
              <div class="total-programs">
              ${outputTypesCount} Output Types
              </div>
              <div class="total-awards">
              ${outputDetail}
              </div>
              </div>`;

        tooltip
          .html(tooltipHtml)
          .style('left', mouseEvent.pageX + 'px')
          .style('top', mouseEvent.pageY + 'px')
          .style('opacity', 1);
      })
      .on('mouseout', function (d) {
        tooltip.style('opacity', 0);
      });

    /* ADD NODES */
    let node = svg
      .append('g')
      .selectAll('.node')
      .data(() => {
        return chart.nodes;
      })
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
        return (d.color = color(d.name));
      })
      .style('stroke', (d) => d3.rgb(d.color).darker(2));

    /* ADD NODE TITLES */
    node
      .append('text')
      .attr('x', (d) => d.x0 - 6)
      .attr('y', (d) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => {
        return d.name;
      })
      .filter((d) => d.x0 < width / 2)
      .attr('x', (d) => d.x1 + 6)
      .attr('text-anchor', 'start');
  });
