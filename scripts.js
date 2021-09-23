import 'regenerator-runtime/runtime';
let kebabCase = require('lodash.kebabcase');
import { min, max } from 'd3-array';
import { select, selectAll } from 'd3-selection';
import { csv } from 'd3-fetch';
import { sankey, sankeyCenter, sankeyLinkHorizontal } from 'd3-sankey';
import { format } from 'd3-format';
import { scaleSqrt, scaleLinear } from 'd3-scale';
import { nest } from 'd3-collection';
import { transition } from 'd3-transition';


let issuesToEngagement = require(`./data/9-21-21-Copy of Sankey data - Moz F&A - Issue Area _ Program _ Output.csv`);
let engagementToOutput = require(`./data/9-21-21-Copy of Sankey data - Moz F&A - Output _ Program _ Issue Area.csv`);
let focusTotalInvestment = require(`./data/9-21-21-Copy of Sankey data - Moz F&A - FOCUS - Total Investment $.csv`);
let programTotalInvestment = require(`./data/9-21-21-Copy of Sankey data - Moz F&A - PROGRAMS - Total Investment $.csv`);
let outputTotalInvestment = require(`./data/9-21-21-Copy of Sankey data - Moz F&A - OUTPUT - Total Investment $.csv`);

const d3 = Object.assign(
  {},
  {
    csv,
    nest,
    scaleLinear,
    scaleSqrt,
    select,
    selectAll,
    min,
    max,
    sankey,
    sankeyCenter,
    sankeyLinkHorizontal,
    format,
    transition
  }
);

/* SET UP GRAPH DIMENSIONS */
let margin = { top: 15, right: 15, bottom: 30, left: 15 };
let height =
  document.querySelector('#container').clientHeight -
  (margin.top + margin.bottom);
let width =
  document.querySelector('#container').clientWidth -
  (margin.left + margin.right);

/* SET UP STYLE VARIABLES */
let defaultOpacity = 0.3;
let hoverOpacity = 1;
let fadeOpacity = 0.1;

/* SETUP VARIABLES */
let awardsData;
let nestedIssues;
let issuesProgramDetail;
let programsToOutput;
let elementClasses = {};
let outputsToProgram;
let tooltip;
let tooltipHtml;
let focusInvestment;
let programInvestment;
let outputInvestment;

/* APPEND SVG TO PAGE */
let svg = d3
  .select('#container')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .attr('viewBox', [0, 0, width, height])
  .attr('preserveAspectRatio', 'xMinYMin meet')
  .append('g');

/* SETUP SANKEY PROPERTIES */
let sankeyGraph = d3
  .sankey()
  .iterations(0)
  .nodePadding(8)
  .size([width, height]);

/* ADD TOOLTIPS */
tooltip = d3.select('body').append('div').attr('id', 'tooltip');

/* FORMAT DATA */
Promise.all([
  d3.csv(issuesToEngagement),
  d3.csv(engagementToOutput),
  d3.csv(focusTotalInvestment),
  d3.csv(programTotalInvestment),
  d3.csv(outputTotalInvestment)
]) // begin
  .then((data) => {
    // Investment numbers for tooltip
    focusInvestment = data[2];
    programInvestment = data[3];
    outputInvestment = data[4];

    // Graph data
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

    // Store transformed data before replacing link names
    issuesProgramDetail = graph.links;

    /* SAVE Outputs to Program for output tooltip */
    outputsToProgram = d3
      .nest()
      .key((d) => d['Primary Output\n(pick ONE)'])
      .key((d) => d['Program'])
      .entries(data[1]);

    /* TRANSFORM SECOND SANKEY */
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

    // Replace link names
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
    return graph;
  })
  .then((data) => {
    let chart = sankeyGraph(data);

    function initialize() {
      // ADD LINKS
      svg
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

      // ADD NODES
      let node = svg
        .append('g')
        .selectAll('.node')
        .data(() => {
          return chart.nodes;
        })
        .enter()
        .append('g')
        .attr('class', 'node');

      // ADD NODE RECTANGLES
      node.append('rect');

      // ADD NODE TITLES
      node.append('text');
    } // end initialize

    const getTooltipPositionY = (event) => {
      let tooltipDetail = document
        .querySelector(`#tooltip`)
        .getBoundingClientRect();
      let containerDetail = document
        .querySelector(`#container`)
        .getBoundingClientRect();

      return tooltipDetail.height + event.pageY > containerDetail.height
        ? containerDetail.height - event.pageY / 4 - tooltipDetail.height
        : event.pageY;
    };

    const getTooltipPositionX = (event) => {
      let tooltipDetail = document
        .querySelector(`#tooltip`)
        .getBoundingClientRect();
      let containerDetail = document
        .querySelector(`#container`)
        .getBoundingClientRect();

      if (
        event.pageX > containerDetail.width * 0.34 &&
        event.pageX < containerDetail.width * 0.67
      ) {
        return event.pageX - tooltipDetail.width / 2;
      } else if (event.pageX < containerDetail.width * 0.34) {
        return event.pageX;
      } else if (event.pageX > containerDetail.width * 0.67) {
        return event.pageX - tooltipDetail.width;
      }
    };
    const updateLinks = () =>
      svg
        .selectAll('.link')
        .data(() => {
          return chart.links;
        })
        .attr('d', sankeyLinkHorizontal());

    const updateNodes = () =>
      svg
        .selectAll('.node')
        .data(() => {
          return chart.nodes;
        })
        .selectAll('rect')
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

    const updateText = () =>
      svg
        .selectAll('text')
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

    const addTooltips = () => {
      d3.selectAll('.link')
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
            .style(
              'top',
              () => getTooltipPositionY(event) + margin.bottom + 'px'
            )
            .style(
              'left',
              () => getTooltipPositionX(event) + sankeyGraph.nodeWidth() + 'px'
            )
            .classed('visible', true);
          d3.selectAll('.link')
            .transition()
            .duration(200)
            .style('stroke-opacity', fadeOpacity);
          d3.select(this)
            .transition()
            .duration(200)
            .style('stroke-opacity', hoverOpacity);
        })
        .on('mouseout', function (d) {
          tooltip.classed('visible', false);

          d3.selectAll('.link')
            .transition()
            .duration(100)
            .style('stroke-opacity', defaultOpacity);
        });

      // ADD TOOLTIPS TO ISSUE AREA NODES
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

          let investment = focusInvestment.filter(
            (focus) => focus['Issue Area Tags\n(pick ONE) '] === data.name
          )[0];
          if (data.name === `Other/unavailable`) {
            tooltipHtml = `
            <div class="details">
            <div class="issue-title">
              ${data.name}
            </div>
            <div class="total-programs">
            </div>
            <div class="total-awards">
              ${awardsData}
            </div>
            <div class="total-investment">
              Total investment: 2016-2020: ${investment['SUM of Fellow/ Award Amount \n(total, incl suppl)']}
            </div>
          </div>  
            `;
          } else {
            tooltipHtml = `
              <div class="details">
                <div class="issue-title">
                  ${data.name}
                </div>
                <div class="total-programs">
                  ${nodeData.length} programs supported work on ${data.name}
                </div>
                <div class="total-awards">
                  ${awardsData}
                </div>
                <div class="total-investment">
                  Total investment: 2016-2020: ${investment['SUM of Fellow/ Award Amount \n(total, incl suppl)']}
                </div>
              </div>  
            `;
          }

          tooltip
            .html(tooltipHtml)
            .style(
              'top',
              () => getTooltipPositionY(event) - margin.bottom + 'px'
            )
            .style('left', event.pageX + sankeyGraph.nodeWidth() + 'px')
            .classed('visible', true);

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
          tooltip.classed('visible', false);
          d3.selectAll('.link')
            .transition()
            .duration(100)
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

          let investment = programInvestment.filter(
            (program) => program['Program'] === data.name
          )[0];
          tooltipHtml = `
            <div class="details">
              <div class="issue-title">
                ${data.name}
              </div>
              <div class="issues-list">
                <span class="detail-heading">Internet Health Issue Area</span>
                ${data.targetLinks
                  .map((d) => {
                    return `${d.source.name} - ${d.rawValue} ${
                      d.rawValue > 1 ? 'awards' : 'award'
                    }`;
                  })
                  .sort()
                  .join('</br>')}
                  </div>
                  <div class="outputs-list">
                  <span class="detail-heading">Fellow and Awardee Outputs</span>
                ${outputs
                  .map(
                    (output) =>
                      `${output[0]} - ${output[1]} ${
                        parseInt(output[1]) > 1 ? 'awards' : 'award'
                      }`
                  )
                  .join('</br>')}
                </div>
                <div class="total-investment">
                Total investment 2016-2020: ${
                  investment[
                    'SUM of Fellow/ Award Amount \n(total, incl suppl)'
                  ]
                }
              </div>
            </div>
          `;

          tooltip
            .html(tooltipHtml)
            .style('top', () => getTooltipPositionY(event) + 20 + 'px')
            .style('left', () => getTooltipPositionX(event) + 'px')
            .classed('visible', true);

          d3.selectAll(`*:not(.source-${kebabCase(data.name)})`)
            .transition()
            .duration(200)
            .style('stroke-opacity', fadeOpacity);

          d3.selectAll(`*:not(.target-${kebabCase(data.name)})`)
            .transition()
            .duration(200)
            .style('stroke-opacity', fadeOpacity);

          d3.selectAll(`.link.source-${kebabCase(data.name)}`)
            .transition()
            .duration(200)
            .style('stroke-opacity', hoverOpacity);

          // targetLinks
          d3.selectAll(`.link.target-${kebabCase(data.name)}`)
            .transition()
            .duration(200)
            .style('stroke-opacity', hoverOpacity);
        })
        .on('mouseout', () => {
          tooltip.classed('visible', false);
          d3.selectAll('.link')
            .transition()
            .duration(100)
            .style('stroke-opacity', defaultOpacity);
        });

      /*ADD TOOLTIPS TO OUTPUT NODES */
      d3.selectAll(`.output`)
        .on('mouseover', (event, data) => {
          let nodeData = outputsToProgram.filter((output) => {
            return output.key === data.name;
          })[0];

          let outputPrograms = nodeData.values.reduce((acc, program) => {
            return (acc += `${program.key} - ${program.values.length} ${
              program.values.length > 1 ? 'awards' : `award`
            }</br>`);
          }, ``);

          let investment = outputInvestment.filter(
            (output) => output['Primary Output\n(pick ONE)'] === data.name
          )[0];

          if (data.name === 'Other/not available') {
            tooltipHtml = `
            <div class="details">
              <div class="issue-title">
                ${data.name}
              <span class="detail-heading">
              </span>
              </div>
              <div class="outputs-list">
                ${outputPrograms}
              </div>
              <div class="total-investment">
                Total investment 2016-2020: ${investment['SUM of Fellow/ Award Amount \n(total, incl suppl)']}
              </div>
            </div>
            `;
          } else {
            tooltipHtml = `
              <div class="details">
                <div class="issue-title">
                  ${data.name}
                <span class="detail-heading">
                  ${nodeData.values.length} program(s) had ${data.name} as an output
                </span>
                </div>
                <div class="outputs-list">
                  ${outputPrograms}
                </div>
                <div class="total-investment">
                  Total investment 2016-2020: ${investment['SUM of Fellow/ Award Amount \n(total, incl suppl)']}
                </div>
              </div>
              `;
          }

          tooltip
            .html(tooltipHtml)
            .style(
              'top',
              () => getTooltipPositionY(event) - margin.bottom + 'px'
            )
            .style(
              'left',
              () => getTooltipPositionX(event) - sankeyGraph.nodeWidth() + 'px'
            )
            .classed('visible', true);

          d3.selectAll(`*:not(.target-${kebabCase(data.name)})`)
            .transition()
            .duration(200)
            .style('stroke-opacity', fadeOpacity);

          d3.selectAll(`.link.target-${kebabCase(data.name)}`)
            .transition()
            .duration(200)
            .style('stroke-opacity', hoverOpacity);
        })
        .on('mouseout', () => {
          tooltip.classed('visible', false);
          d3.selectAll('.link')
            .transition()
            .duration(100)
            .style('stroke-opacity', defaultOpacity);
        });
    };

    function draw() {
      const newDimensions = document
        .querySelector('#container')
        .getBoundingClientRect();
      // Resize SVG
      d3.select('svg')
        .attr('width', newDimensions.width - (margin.left + margin.right))
        .attr('height', newDimensions.height - (margin.top + margin.bottom))
        .attr('viewBox', [
          0,
          0,
          newDimensions.width - (margin.left + margin.right),
          newDimensions.height - (margin.top + margin.bottom)
        ])
        .attr('preserveAspectRatio', 'xMinYMin')
        .append('g');

      const { nodes, links } = chart;
      const newSankey = d3
        .sankey()
        .iterations(0)
        .nodePadding(8)
        .size([
          newDimensions.width - (margin.left + margin.right),
          newDimensions.height - (margin.top + margin.bottom)
        ]);

      newSankey.nodes(nodes).links(links)();
      updateLinks();
      updateNodes();
      updateText();
      addTooltips();
    } // end draw *****************************************

    /** RESIZE WINDOW AND REDRAW SVG */
    initialize();
    draw();
    window.addEventListener('resize', draw);
  });
