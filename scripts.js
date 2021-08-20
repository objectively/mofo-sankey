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
import { transition } from 'd3-transition';

let realIssuesToEngagement = require(`./data/real/Sankey data - Moz F&A - Issue Area _ Program _ Output.csv`);
let realEngagementToOutput = require(`./data/real/Sankey data - Moz F&A - Output _ Program _ Issue Area.csv`);

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

var height = 500/aspect;
var width = 800/aspect;

/*
  FORMATTING HELPERS
*/
const color = d3.scaleOrdinal(schemeCategory10);

// SETUP VARIABLES
let awardsData;
let nestedIssues;
let issuesProgramDetail;
let programsToOutput;
let elementClasses = {};
let outputsToProgram;
let tooltip;
let tooltipHtml;
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
  .nodeWidth(20)
  .nodePadding(10)
  .size([width, height]);

let path = sankeyGraph.links();

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
          .transition().duration(200).style('opacity', 1);
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

    /* ADD NODE RECTANGLES */
    node
      .append('rect')
      .attr('class', (d) => {
        return `rect ${slugify(d.name, { lower: true })} ${
          elementClasses[d.name]
        }`;
      })
      .attr('x', (d) => d.x0)
      .attr('y', (d) => d.y0)
      .attr('height', (d) => {
        return d.y1 - d.y0;
      })
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

    /** HIGHLIGHT ALL RELATED PATHS ON NODE MOUSEOVER */
    d3.selectAll('.issue-area')
      .on('mouseover', (event, data) => {
        d3.selectAll(`.${slugify(data.name).toLowerCase()}`).transition().duration(200).style(
          'stroke-opacity',
          0.7
        );
      })
      .on('mouseout', () => {
        d3.selectAll('.link').transition().duration(200).style('stroke-opacity', 0.2);
      });

    /** HIGHLIGHT INDIVIDUAL LINE */

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
          .style('left', (event.pageX + 50) + 'px')
          .style('top', event.pageY + 'px')
          .transition().duration(200).style('opacity', 1);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
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
          .style('left', (event.pageX - 150) + 'px')
          .style('top', (event.pageY + 50)+ 'px')
          .transition().duration(200).style('opacity', 1);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
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
          .style('left', (event.pageX - 350)+ 'px')
          .style('top', (event.pageY - 25) + 'px')
          .transition().duration(200).style('opacity', 1);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
      });
  });
