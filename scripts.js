import 'regenerator-runtime/runtime';
var slugify = require('slugify');
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

const width = 1000;
const height = 800;

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
let nestedIssues;
let issuesProgramDetail;
let programsToOutput;
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
  .nodeWidth(20)
  .nodePadding(5)
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
    nestedIssues = d3
      .nest()
      .key((d) => d['Issue Area Tags\n(pick ONE) '])
      .key((d) => d['Program'])
      .entries(data[0]);

    nestedIssues = nestedIssues.map((issue) => {
      return issue.values.map((value) => {
        return {
          source: issue.key,
          target: value.key,
          totalAwards: value.values.reduce((acc, award) => {
            return (acc += parseInt(award['Number of Awards']));
          }, 0)
        };
      });
    });

    nestedIssues.forEach((data) => {
      data.forEach((issue) => {
        graph.nodes.push({
          name: issue.source
        });

        graph.nodes.push({ name: issue.target });

        graph.links.push({
          source: issue.source,
          target: issue.target,
          value: issue.totalAwards
        });
      });
    });

    //store transformed data before replacing link names
    issuesProgramDetail = graph.links;

    /* TRANSFROM SECOND SANKEY*/
    programsToOutput = d3
      .nest()
      .key((d) => d['Program'])
      .key((d) => d['Primary Output\n(pick ONE)'])
      .entries(data[1]);

    programsToOutput = programsToOutput.map((program) => {
      return program.values.map((value) => {
        return {
          source: program.key,
          target: value.key,
          totalAwards: value.values.reduce((acc, award) => {
            return (acc += parseInt(award[' Number of awards']));
          }, 0)
        };
      });
    });
    console.log('programs to output');

    programsToOutput.forEach((program) => {
      program.forEach((p) => {
        graph.nodes.push({ name: p.source });
        graph.nodes.push({ name: p.target });
        graph.links.push({
          source: p.source,
          target: p.target,
          value: p.totalAwards
        });
      });
    });

    let uniqueNodesStr = new Set(
      graph.nodes.map((node) => JSON.stringify(node))
    );

    // return unique nodes
    graph.nodes = Array.from(uniqueNodesStr).map((node, idx) => {
      return Object.assign({ node: idx }, JSON.parse(node));
    });

    console.log('are these unique');
    console.log(graph.nodes.map((n) => n.name).sort());

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
      .attr('class', (d) => {
        return `link ${slugify(d.source.name).toLowerCase()}`;
      })
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke-width', (d) => d.width);

    /**
     *  ADD TOOLTIPS
     */
    /*
     */
    link
      .on('mouseover', function (event, data) {
        let tooltipHtml = `
        <div class="details">
          <div class="issue-title">
          ${data.source.name}
          </div>
          <div class="total-awards">
          ${data.target.name} - ${data.value} Awards
          </div>
          </div>
        `;

        tooltip
          .html(tooltipHtml)
          .style('left', event.pageX + 'px')
          .style('top', event.pageY + 'px')
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
      .attr('class', (d) => `rect ${slugify(d.name).toLowerCase()} issue-area`)
      .attr('x', (d) => d.x0)
      .attr('y', (d) => d.y0)
      .attr('height', (d) => {
        if (d.y1 - d.y0 == 0) {
          console.log(d.name);
        }
        return d.y1 - d.y0;
      })
      .attr('width', sankeyGraph.nodeWidth())
      .style('fill', (d) => {
        return (d.color = color(d.name));
      })
      .style('stroke', (d) => d3.rgb(d.color).darker(2));

    /* ADD TOOLTIPS TO NODE RECTANGLES */

    d3.selectAll(`.rect`)
      .on('mouseover', (event, data) => {
        let nodeData = issuesProgramDetail.filter(
          (program) => program.source.name === data.name
        );

        if (nodeData) {
          awardsData = nodeData.reduce((acc, issue) => {
            return (acc += `${issue.target.name} - ${issue.value} ${
              issue.value > 1 ? 'awards' : `award`
            }${'</br>'}`);
          }, ``);
        }

        let tooltipHtml =
          data.nodeType === 'issue'
            ? `
          <div class="details">
          <div class="issue-title">
          ${data.name}
          </div>
          <div class="total-programs">
          ${nodeData.length} Programs
          </div>
          <div class="total-awards">
          ${awardsData}
          </div>
          </div>
          `
            : `<div class="details">
          <div class="issue-title">
          ${data.name}
          </div>
          <div class="total-programs">
          X Output Types
          </div>
          <div class="total-awards">
          XDETAILX
          </div>
          </div>`;

        tooltip
          .html(tooltipHtml)
          .style('left', event.pageX + 'px')
          .style('top', event.pageY + 'px')
          .style('opacity', 1);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });

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

    /** HIGHLIGHT ALL RELATED PATHS ON NODE MOUSEOVER */
    d3.selectAll('.node')
      .on('mouseover', (event, data) => {
        d3.selectAll(`.${slugify(data.name).toLowerCase()}`).style(
          'stroke-opacity',
          0.7
        );
      })
      .on('mouseout', () => {
        d3.selectAll('.link').style('stroke-opacity', 0.2);
      });

    /** HIGHLIGHT INDIVIDUAL LINE */
  });
