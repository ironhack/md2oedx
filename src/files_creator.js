const { Converter } = require('showdown');
const fs = require('fs-extra');
const klaw = require('klaw-sync');
const R = require('ramda');
const xml = require('xmlbuilder');
const xmlFormatter = require('xml-formatter');

const typeChild = {
  course: 'chapter',
  chapter: 'sequential',
  sequential: 'vertical',
  vertical: 'html'
};

module.exports = {
  createMdFiles,
  createXmlFiles
};

function createMdFiles(sourcePath) {
  const converter = new Converter();
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
          converter.makeHtml.bind(converter)
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
  const childType = typeChild[nodeType];
  const children = R.propOr([], childType, node);
  const nodeFileName = `${fileName}-${R.replace(
    '_0',
    '',
    `${nodeType}_${nodeIndex}`
  )}`;
  const xmlNode = createNode(nodeType, node, nodeFileName, children.length);
  files[`${nodeType}/${nodeFileName}.xml`] = xmlNode;
  R.addIndex(R.forEach)((child, index) => {
    buildTree(files, nodeFileName, child, index, childType);
  }, children);
}

function createNode(type, nodeInfo, fileName, childrenCount) {
  const childrenType = typeChild[type];
  const xmlObject = {
    [type]: {
      '@display_name': nodeInfo.name,
      '@filename': nodeInfo.file
        ? R.slice(0, -3, R.replace(/\//g, '-', nodeInfo.file))
        : undefined,
      [childrenType]: R.times(
        index => ({
          '@url_name': `${fileName}-${R.replace(
            '_0',
            '',
            `${childrenType}_${index}`
          )}`
        }),
        childrenCount
      )
    }
  };
  const node = xml.create(xmlObject);
  return xmlFormatter(node.toString());
}
