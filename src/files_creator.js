const hackmdToHtml = require('hackmd-to-html');
const fs = require('fs-extra');
const klaw = require('klaw-sync');
const R = require('ramda');
const xml = require('xmlbuilder');
const xmlFormatter = require('xml-formatter');

const typeChild = {
  course: 'chapter',
  chapter: 'sequential',
  sequential: 'vertical',
  vertical: 'component'
};

const deliverableKeys = [
  'display_name',
  'deliverable_identifier',
  'deliverable_description',
  'deliverable_duedate'
];

module.exports = {
  createMdFiles,
  createXmlFiles
};

function createMdFiles(sourcePath) {
  const markdownFiles = R.pipe(
    klaw,
    R.pluck('path'),
    R.filter(R.endsWith('.md')),
    R.map(R.replace(sourcePath, '')),
    R.juxt([
      R.map(
        R.pipe(
          R.slice(1, Infinity),
          R.replace(/\//g, '-'),
          R.replace(/.md$/, '.html'),
          R.concat('html/')
        )
      ),
      R.map(
        R.pipe(
          R.concat(`${sourcePath}`),
          fs.readFileSync,
          R.invoker(0, 'toString'),
          hackmdToHtml
        )
      )
    ]),
    R.apply(R.zip),
    R.fromPairs
  )(sourcePath);
  return markdownFiles;
}

function createXmlFiles(index) {
  let files = {
    'course.xml': xml
      .create({
        course: {
          '@url_name': 'ironhack-course',
          '@org': 'IRONHACK',
          '@course': index.course.number
        }
      })
      .toString()
  };
  buildTree(files, 'ironhack', index.course, 0, 'course');
  return files;
}

// const index = require('../test/index.json');
// console.log(createXmlFiles(index));

function buildTree(files, fileName, node, nodeIndex, nodeType) {
  nodeType = getRealType(nodeType, node.type);

  // deliverables don't need individual files created
  if (nodeType === 'deliverable') {
    return;
  }

  const childType = typeChild[nodeType];
  const children = R.propOr([], childType, node);
  const nodeFileName = `${fileName}-${R.replace(
    '_0',
    '',
    `${nodeType}_${nodeIndex}`
  )}`;
  const xmlNode = createNode(nodeType, node, nodeFileName, children);
  files[`${nodeType}/${nodeFileName}.xml`] = xmlNode;
  R.addIndex(R.forEach)((child, index) => {
    buildTree(files, nodeFileName, child, index, childType);
  }, children);
}

function createNode(type, nodeInfo, fileName, children) {
  const childrenType = typeChild[type];
  const xmlObject = {
    [type]: {
      '@display_name': nodeInfo.name,
      '@filename': nodeInfo.file
        ? R.slice(0, -3, R.replace(/\//g, '-', nodeInfo.file))
        : undefined
    }
  };
  // use reduce() and ele() to build children
  // (they vary in types and attributes)
  const node = R.addIndex(R.reduce)(
    (acc, child, index) => {
      const realType = getRealType(childrenType, child.type);
      const childXml = {
        url_name: `${fileName}-${R.replace(
          '_0',
          '',
          `${realType}_${index}`
        )}`
      };
      return acc.ele(realType, R.ifElse(
        R.propEq('type', 'deliverable'),
        R.pipe(R.pick(deliverableKeys), R.mergeRight(childXml)),
        R.always(childXml)
      )(child)).up();
    },
    xml.create(xmlObject),
    children
  );
  return xmlFormatter(node.toString());
}

function getRealType(originalType, subtype) {
  return R.when(
    R.equals('component'),
    R.always(subtype || 'html'),
    originalType
  );
}
