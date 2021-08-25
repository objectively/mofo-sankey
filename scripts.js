import 'regenerator-runtime/runtime';
let kebabCase = require('lodash.kebabcase');
import { min, max } from 'd3-array';
import { select, selectAll } from 'd3-selection';
import { csv, json } from 'd3-fetch';
import { sankey, sankeyCenter, sankeyLinkHorizontal } from 'd3-sankey';
import { format } from 'd3-format';
import { scaleSqrt, scaleOrdinal, scaleLinear } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import { nest } from 'd3-collection';
import { transition } from 'd3-transition';
import { interpolate, interpolateNumber } from 'd3-interpolate';
import { linkHorizontal } from 'd3-shape';
import {
  customLinkGenerator,
  customLinkGenerator2
} from './helpers/custom-link-generator';

let realIssuesToEngagement = require(`./data/real/Sankey data - Moz F&A - Issue Area _ Program _ Output.csv`);
let realEngagementToOutput = require(`./data/real/Sankey data - Moz F&A - Output _ Program _ Issue Area.csv`);

const d3 = Object.assign(
  {},
  {
    csv,
    nest,
    scaleSqrt,
    select,
    selectAll,
    interpolateNumber,
    json,
    linkHorizontal,
    min,
    max,
    sankey,
    sankeyCenter,
    scaleLinear,
    sankeyLinkHorizontal,
    format,
    scaleOrdinal,
    schemeCategory10,
    rgb,
    transition
  }
);

// const jsonUrl = `https://gist.githubusercontent.com/tekd/e9d8aee9e059f773aaf52f1130f98c65/raw/4a2af7014f0a8eed1a384f9d3f478fef6f67b218/sankey-test.json`;

/*
  SET UP GRAPH DIMENSIONS
*/

const aspect = 0.8;

var margin = { top: 0, right: 0, bottom: 0, left: 0 };

var height = 400 / aspect;
var width = 800 / aspect;

/*
  FORMATTING HELPERS
*/

// SETUP VARIABLES
let awardsData;
let nestedIssues;
let issuesProgramDetail;
let programsToOutput;
let elementClasses = {};
let outputsToProgram;
let tooltip;
let tooltipHtml;

/* NODE SCALING http://bl.ocks.org/mydu/1c695db789cc6e30616e */
//node scale

let maxValNode;
let minValNode;
let maxValLinks;
let minValLinks;

let nodeScale;

let linkScale;
let issueNodeScale;
let issueLinkScale;

/*
  APPEND SVG TO PAGE
*/

let svg = d3
  .select('#container')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .append('g');

/*
  SETUP SANKEY PROPERTIES
*/

let sankeyGraph = d3
  .sankey()
  .iterations(32)
  .nodeSort(null)
  .linkSort(null)
  .nodeWidth(25)
  .nodePadding(5)
  .nodeAlign(d3.sankeyCenter)
  .size([width, height])
  .extent([
    [1, 5],
    [width - 1, height - 5]
  ]);

/**
 *  ADD TOOLTIPS
 */
tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

/* 
  FORMAT DATA
*/

Promise.all([d3.csv(realIssuesToEngagement), d3.csv(realEngagementToOutput)]) // begin
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
        // Add issueAreas to elementClasses
        elementClasses[issue.source] = 'issue-area';
        elementClasses[issue.target] = 'program';

        graph.nodes.push({
          name: issue.source
        });
        graph.nodes.push({
          name: issue.target
        });
        graph.links.push({
          source: issue.source,
          target: issue.target,
          value: issue.totalAwards
        });
      });
    });

    //store transformed data before replacing link names
    issuesProgramDetail = graph.links;

    /** SAVE Outputs to Program for output tooltip*/

    outputsToProgram = d3
      .nest()
      .key((d) => d['Primary Output\n(pick ONE)'])
      .key((d) => d['Program'])
      .entries(data[1]);

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

    programsToOutput.forEach((program) => {
      program.forEach((p) => {
        elementClasses[p.source] = 'program';
        elementClasses[p.target] = 'output';
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

    //replace link names
    graph.links.forEach((d, i) => {
      const graphMap = graph.nodes.map((node) => node.name);
      graph.links[i].source = graphMap.indexOf(graph.links[i].source);
      graph.links[i].target = graphMap.indexOf(graph.links[i].target);
    });

    return graph;
  })
  .then((data) => {
    let chart = sankeyGraph(data);
    console.log(chart);

    maxValLinks = d3.max(chart.links.map((link) => link.value));
    minValLinks = d3.min(chart.links.map((link) => link.value));

    issueLinkScale = d3
      .scaleSqrt()
      .domain([minValLinks, maxValLinks])
      .range([1, 10]);

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
        return `link ${kebabCase(d.source.name)} source-${kebabCase(
          d.source.name
        )} target-${kebabCase(d.target.name)} link-${
          elementClasses[d.source.name]
        }`;
      })
      .style('mix-blend-mode', 'multiply')
      .attr('stroke-width', (d) => {
        if (elementClasses[d.target.name] === 'output') {
          return 6;
        }
        return Math.max(1, d.width);
      });

    d3.selectAll('path.link-issue-area').attr('d', sankeyLinkHorizontal());
    d3.selectAll('path.link-program').attr('d', (d) => {
      // console.log(d.source, d.target)
      return customLinkGenerator2(d);
    });
    d3.selectAll('path.link-output').attr('d', (d) => customLinkGenerator(d));
    /**
     *  ADD TOOLTIPS
     */

    link
      .on('mouseover', function (event, data) {
        tooltipHtml = `
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
          .transition()
          .duration(200)
          .style('opacity', 1);
      })
      .on('mouseout', function (d) {
        tooltip.transition().duration(500).style('opacity', 0);
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
    // debugger;
    maxValNode = d3.max(chart.nodes.map((node) => node.sourceLinks.length));
    minValNode = d3.min(chart.nodes.map((node) => node.sourceLinks.length));

    issueNodeScale = d3
      .scaleSqrt()
      .domain(
        Array.from(d3.selectAll('.node')).map((node) => node.__data__.value)
      )
      .range([10, 20]);
    // /* ADD NODE RECTANGLES */
    // node
    //   .append('rect')
    //   .attr('class', (d) => {
    //     return `rect ${kebabCase(d.name)} ${elementClasses[d.name]}`;
    //   })
    //   .attr('x', (d) => d.x0)
    //   .attr('y', (d) => d.y0)
    //   .attr('height', (d) => {
    //     return issueNodeScale(d.y1 - d.y0);
    //   })
    //   .attr('width', (d) => d.x1 - d.x0);

    /* ADD NODE RECTANGLES */
    node
      .append('rect')
      .attr('class', (d) => {
        return `rect ${kebabCase(d.name)} ${elementClasses[d.name]}`;
      })
      .attr('x', (d) => {
        return d.x0;
      })
      .attr('y', (d) => {
        return d.y0;
      })
      .attr('height', (d) => {
        if (elementClasses[d.name] === 'output') {
          return 15;
          // return d3.max(
          //   chart.links.map((link) => link.source.sourceLinks.length)
          // );
        }
        return d.y1 - d.y0;
      })
      .attr('width', (d) => d.x1 - d.x0);

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

    /** ALL MOUSEOVER EVENTS */

    // ADD TOOLTIPS TO ISSUE AREA NODES
    d3.selectAll(`.issue-area`)
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
        tooltipHtml = `
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
        `;
        tooltip
          .html(tooltipHtml)
          .style('left', event.pageX + 50 + 'px')
          .style('top', event.pageY + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);

        // highlight all related lines
        d3.selectAll(`.link.${kebabCase(data.name)}`)
          .transition()
          .duration(200)
          .style('stroke-opacity', 0.7);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link')
          .transition()
          .duration(200)
          .style('stroke-opacity', 0.2);
      });

    // ADD TOOLTIPS TO PROGRAM NODES
    d3.selectAll(`rect.program`)
      .on('mouseover', (event, data) => {
        let nodeData = issuesProgramDetail.filter(
          (program) => program.source.name === data.name
        );
        let outputs = data.sourceLinks
          .map((d) => [d.target.name, d.value])
          .sort();

        tooltipHtml = `
            <div class="details">
              <div class="issue-title">
                ${data.name}
              </div>
              <div class="issues-list">
                <span class="detail-heading">Issues</span>
                ${data.targetLinks
                  .map((d) => d.source.name)
                  .sort()
                  .join('</br>')}
              </div>
              <div class="outputs-list">
                <span class="detail-heading">Outputs</span>
                  ${outputs
                    .map((output) => `${output[1]} ${output[0]}`)
                    .join('</br>')}
              </div>
            </div>
          `;
        tooltip
          .html(tooltipHtml)
          .style('left', event.pageX - 150 + 'px')
          .style('top', event.pageY + 50 + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);

        // issue links
        // sourceLinks
        d3.selectAll(`.link.source-${kebabCase(data.name)}`).style(
          'stroke-opacity',
          1
        );

        // targetLinks
        d3.selectAll(`.link.target-${kebabCase(data.name)}`).style(
          'stroke-opacity',
          1
        );
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link').style('stroke-opacity', 0.2);
      });

    // ADD TOOLTIPS TO OUTPUT NODES
    d3.selectAll(`.output`)
      .on('mouseover', (event, data) => {
        let nodeData = outputsToProgram.filter((output) => {
          return output.key === data.name;
        })[0];

        let outputPrograms = nodeData.values.reduce((acc, program) => {
          return (acc += `${program.key} - ${program.values.length}</br>`);
        }, ``);

        tooltipHtml = `
            <div class="details">
              <div class="issue-title">
                ${data.name}
              </div>
              <div class="outputs-list">
                <span class="detail-heading">Programs creating this output</span>
                  ${outputPrograms}
              </div>
            </div>
          `;
        tooltip
          .html(tooltipHtml)
          .style('left', event.pageX - 350 + 'px')
          .style('top', event.pageY - 25 + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);

        d3.selectAll(`.link.target-${kebabCase(data.name)}`).style(
          'stroke-opacity',
          1
        );
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link').style('stroke-opacity', 0.2);
      });
  });
