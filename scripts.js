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

/*
  SET UP GRAPH DIMENSIONS
*/

let margin = { top: 20, right: 50, bottom: 20, left: 50 };

let height =
  document.querySelector('#container').clientHeight -
  (margin.top + margin.bottom);
let width =
  document.querySelector('#container').clientWidth -
  (margin.left + margin.right);

let defaultOpacity = 0.3;
let hoverOpacity = 1;
let fadeOpacity = 0.1;

// SETUP VARIABLES
let awardsData;
let nestedIssues;
let issuesProgramDetail;
let programsToOutput;
let elementClasses = {};
let outputsToProgram;
let tooltip;
let tooltipHtml;

// APPEND SVG TO PAGE

let svg = d3
  .select('#container')
  .append('svg')
  .attr(
    'width',
    document.querySelector('#container').clientWidth +
      (margin.left + margin.right)
  )
  .attr(
    'height',
    document.querySelector('#container').clientHeight +
      (margin.top + margin.bottom)
  )
  .attr(
    'viewBox',
    `0 0 ${document.querySelector('#container').clientWidth} ${
      document.querySelector('#container').clientHeight
    }`
  )
  .attr('preserveAspectRatio', 'xMinYMin')
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

/*
  SETUP SANKEY PROPERTIES
*/

let sankeyGraph = d3
  .sankey()
  .iterations(0)
  // .nodePadding(15)
  // .linkSort(null)
  // .nodeSort(null)
  .size([width, height]);

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

    let linkScale = d3.scaleSqrt().domain([0, 84]).range([5, 80]);

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
    let minLinkVal = d3.min(graph.links.map((link) => link.value));
    let maxLinkVal = d3.max(graph.links.map((link) => link.value));
    linkScale = d3
      .scaleLinear()
      .domain([minLinkVal, maxLinkVal])
      .range([14, 84]);
    
    graph.links.forEach((link) => {
      link.rawValue = link.value;
      link.value = linkScale(link.value);
    });
    console.log(graph);
    return graph;
  })
  .then((data) => {
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
        return `link ${kebabCase(d.source.name)} source-${kebabCase(
          d.source.name
        )} target-${kebabCase(d.target.name)} link-${
          elementClasses[d.source.name]
        }`;
      })
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke-width', (d) => {
        return d.width;
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

    // /* ADD NODE RECTANGLES */
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
      .attr('height', (d, i) => {
        return d.y1 - d.y0;
      })
      .attr('width', (d) => {
        return sankeyGraph.nodeWidth();
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
              ${data.target.name} - ${data.rawValue} Awards
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
        d3.selectAll('.link')
          .transition()
          .duration(100)
          .style('stroke-opacity', fadeOpacity);
        d3.select(this)
          .transition()
          .duration(100)
          .style('stroke-opacity', hoverOpacity);
      })
      .on('mouseout', function (d) {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link')
          .transition()
          .duration(100)
          .style('stroke-opacity', defaultOpacity);
      });

    /** ALL MOUSEOVER EVENTS */

    /** LINK MOUSEOVER */

    // ADD TOOLTIPS TO ISSUE AREA NODES
    /*
    d3.selectAll(`.issue-area`)
      .on('mouseover', (event, data) => {
        let nodeData = issuesProgramDetail.filter(
          (program) => program.source.name === data.name
        );

        if (nodeData) {
          awardsData = nodeData.reduce((acc, issue) => {
            return (acc += `${issue.target.name} - ${issue.rawValue} ${
              issue.rawValue > 1 ? 'awards' : `award`
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

        d3.selectAll('.link')
          .transition()
          .duration(200)
          .style('stroke-opacity', fadeOpacity);
        // highlight all related lines

        d3.selectAll(`.link.${kebabCase(data.name)}`)
          .transition()
          .duration(200)
          .style('stroke-opacity', hoverOpacity);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link')
          .transition()
          .duration(200)
          .style('stroke-opacity', defaultOpacity);
      });

    // ADD TOOLTIPS TO PROGRAM NODES
    d3.selectAll(`rect.program`)
      .on('mouseover', (event, data) => {
        let nodeData = issuesProgramDetail.filter(
          (program) => program.source.name === data.name
        );
        let outputs = data.sourceLinks
          .map((d) => [d.target.name, d.rawValue])
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
          .style('top', event.pageY + 150 + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);

        d3.selectAll('.link').style('stroke-opacity', fadeOpacity);
        // issue links
        // sourceLinks
        d3.selectAll(`.link.source-${kebabCase(data.name)}`).style(
          'stroke-opacity',
          hoverOpacity
        );

        // targetLinks
        d3.selectAll(`.link.target-${kebabCase(data.name)}`).style(
          'stroke-opacity',
          hoverOpacity
        );
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link')
          .transition()
          .duration(200)
          .style('stroke-opacity', defaultOpacity);
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
                <span class="detail-heading">Programs creating this output</span>
              </div>
              <div class="outputs-list">
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

        d3.selectAll('.link').style('stroke-opacity', fadeOpacity);

        d3.selectAll(`.link.target-${kebabCase(data.name)}`).style(
          'stroke-opacity',
          hoverOpacity
        );
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
        d3.selectAll('.link').style('stroke-opacity', defaultOpacity);
      });
      */
  });
