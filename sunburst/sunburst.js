import 'regenerator-runtime/runtime';
import { arc } from 'd3-shape';
import { hierarchy, partition } from 'd3-hierarchy';
import { select, selectAll } from 'd3-selection';
import { json } from 'd3-fetch';

const d3 = Object.assign(
  {},
  {
    arc,
    hierarchy,
    json,
    partition,
    select,
    selectAll
  }
);

const width = 500;
const height = 500;
const radius = Math.min(width, height) / 10.3;

const setPartition = data => {
  const root = d3.hierarchy(data)
    .sum(d => (d.children || d.count))
  return d3.partition().size([2 * Math.PI, root.height + 1])(root);
};

const setArc = d3.arc()
  .startAngle(d => d.x0)
  .endAngle(d => d.x1)
  .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005 - 500))
  .padRadius(0)
  .innerRadius(d => d.y0 * radius + 55)
  .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius + 55));

// Tooltips and html formatting
const tooltips = d3
  .select('.sunburst-text')
  .append('div')
  .attr('class', 'row tooltips');

const formatHTML = d => {
  const layer = d.depth;
  const { data } = d;

  if (layer === 1) {
    let awardAmount = Math.round(data.totalAwardAmount * 100) / 100;
    awardAmount = awardAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    tooltips.html(
      `<div class="column large-12 small-12">
        <h2 class="title">${data.name}</h2>
      </div>
      <div class="column large-5 small-12">
        <h3>Strategy/Focus</h3>
        <h4>${data.focus}</h4>
        <p>${data.description}</p>
      </div>
      <div class="column large-7 small-12">
        <h3>Types of Programs</h3>
        <p>${data.children.length}</p>
        <h3>Total Award Amount</h3>
        <p>$${awardAmount}</p>
        <h3>Countries Represented</h3>
        <p>${data.awardedCountries.length}</p>
      </div>`
    );
  } else if (layer === 2) {
    let issueAreaHTML = '';

    data.children.forEach(issueArea => {
      issueAreaHTML += `<p>${issueArea.name}</p>`;
    });

    tooltips.html(
      `<div class="column large-12 small-12">
        <span class="parent-data">${d.parent.data.name}</span>
        <h2 class="title">${data.name}</h2>
      </div>
      <div class="column large-5 small-12">
        <h3>Program Focus</h3>
        <p>${data.purpose}</p>
      </div>
      <div class="column large-7 small-12">
        <h3>Geographic Focus</h3>
        <p>${data.allCountriesPerType.sort().join(', ')}</p>
        <h3>Number of Awards</h3>
        <p>${data.count}</p>
        <h3>Internet Health Issues</h3>
        ${issueAreaHTML}
      </div>`
    );
  } else if (layer === 3) {
    let html = '';

    data.primaryOutput.forEach(output => {
      html += `<p>${output}</p>`;
    });

    tooltips.html(
      `<div class="column large-12 small-12">
        <span class="parent-data">${d.parent.parent.data.name} | ${d.parent.data.name}</span>
        <h2 class="title">${data.name}</h2>
      </div>
      <div class="column large-5 small-12">
        <h3>Summary</h3>
        <p>${data.description}</p>
      </div>
      <div class="column large-7 small-12">
        <h3>Number of Awards</h3>
        <p>${data.count}</p>
        <h3>Types of Outputs</h3>
        <p>${html}</p>
      </div>`
    );
  }
};

// Highlight on hover
const getAncestors = node => {
  const path = [];
  let current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
};

const highlightSequence = d => {
  const sequenceArray = getAncestors(d);
  d3.selectAll('path')
    .filter(node => sequenceArray.indexOf(node) < 0)
    .classed('ancestor', true);
};

const removeHighlight = d => {
  const sequenceArray = getAncestors(d);
  d3.selectAll('path')
    .filter(node => sequenceArray.indexOf(node) < 0)
    .classed('ancestor', false);
};

// Specify colors
const colors = {
  '2016': '#7b615c',
  '2017': '#de783b',
  '2018': '#6ab975',
  '2019': '#a173d1',
  '2020': '#bbbbbb',
  '2021': '#5687d1',
  'Open Web Fellows': 'rebeccapurple',
  'Open Science Fellows': 'hotpink'
};

const file = require('../data/sunburst.json');

// d3.json(file).then((data) => {
d3.json('https://gist.githubusercontent.com/enabek/0de2d662e9190833ef18edf089af6403/raw/1c5f7a52163865f7ca5701b0ba7fbe262c16ce2e/test').then((data) => {
  const root = setPartition(data);
  root.each(d => d.current = d);

  const svg = d3
    .select('svg#sunburst')
    .attr('viewBox', `0, 0, ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g').attr('transform', `translate(${width / 2},${width / 2})`);

  g
    .selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
    .attr('d', d => setArc(d.current))
    .attr('class', d => `layer-${d.depth}`)
    .style('fill', d => colors[d.data.name])
    .style('stroke', '#FFF')
    .style('stroke-width', 1)
    .on('mouseover', (e, d) => {
      document.querySelector('.large-text').style.display = 'none';
      formatHTML(d);
      highlightSequence(d);
      g
        .append('text')
        .attr('class', 'sunburst-center-text')
        .text('Clear')
        .style('fill', '#bbbbbb')
        .style('font-size', '2rem')
        .attr('x', -40)
        .attr('y', 10)
        .on('mouseover', () => {
          g.select('text').remove();
        });
    })
    .on('mouseleave', d => {
      removeHighlight(d);
      tooltips.html('');
      document.querySelector('.large-text').style.display = 'block';
      g.select('text').remove();
    });
})
.catch((error) => {
  console.error('Error loading the data');
});