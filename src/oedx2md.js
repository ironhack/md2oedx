const path = require('path');
const fs = require('fs-extra');

const _ = require('lodash/fp');
const h2m = require('h2m');
const parseXml = require('xml-js').xml2js;
const R = require('ramda');
const traverse = require('traverse');

const nextLevelMap = {
  course: 'chapter',
  chapter: 'sequential',
  sequential: 'vertical',
  vertical: 'html',
};

module.exports = oedx2md;

async function oedx2md(sourcePath, destinationPath) {
  const finalSource = path.resolve(`${sourcePath}/course.xml`);
  if (fs.existsSync(finalSource) && fs.lstatSync(finalSource).isFile()) {
    let courseIndex = { course: {} };
    const courseXml = fs.readFileSync(finalSource, 'utf8');
    const courseJs = parseXml(courseXml, { compact: true });
    const courseXmlPath = path.resolve(
      `${sourcePath}/course/${courseJs.course._attributes.url_name}.xml`
    );
    courseIndex.course = buildCourseLevel(
      `${sourcePath}`,
      courseXmlPath,
      'course'
    );
    courseIndex.course.number = courseJs.course._attributes.course;

    const markdownFiles = {};
    const imagesToUpload = [];

    https: courseIndex = traverse(courseIndex).map(function (nodeValue) {
      if (this.key === 'file') {
        // Generate markdown
        const htmlFilePath = path.resolve(
          `${sourcePath}/html/${nodeValue}.html`
        );
        const html = fs.readFileSync(htmlFilePath, 'utf8');
        const md = h2m(html, {
          overides: {
            iframe: R.pipe(
              R.propOr({}, 'attrs'),
              R.mapObjIndexed((value, key) => `${key}="${value}"`),
              R.values,
              R.join(' '),
              (attrs) => `<iframe ${attrs}></iframe>`
            ),
            img: (node) => {
              const imgSrc = node.attrs.src;
              if (R.includes('ironhack.school', imgSrc)) {
                const key = R.pipe(
                  R.split('@'),
                  R.last,
                  R.concat('java/')
                )(imgSrc);
                imagesToUpload.push({ src: imgSrc, key });
                return `![${R.pathOr(
                  '',
                  ['attrs', 'alt'],
                  node
                )}](https://ih-materials.s3-eu-west-1.amazonaws.com/${key})`;
                t;
              }
            },
          },
        });

        // Update index content
        const chapter = R.path([...R.take(3, this.path), 'name'], courseIndex);
        const sequential = R.path(
          [...R.take(5, this.path), 'name'],
          courseIndex
        );
        const newFileName = R.pipe(
          R.path(['parent', 'parent', 'parent', 'node', 'name']),
          R.match(/^!?(?:\[.+\])?(?<title>.+)$/),
          R.pathOr('', ['groups', 'title']),
          R.append(R.__, [chapter, sequential]),
          R.map(_.kebabCase),
          R.join('/'),
          R.concat(R.__, '.md')
        )(this);

        markdownFiles[newFileName] = md;
        this.update(newFileName);
      }
    });

    // Migrate Images
    const P = require('p-iteration');
    let count = 1;
    await P.forEachSeries(imagesToUpload, async ({ src, key }) => {
      console.log(`Uploading Image ${count}/${imagesToUpload.length}`, key);
      count++;
      await uploadFileToS3(src, key);
      console.log('Image Uploaded');
    });

    // Write files
    const destination = path.resolve(destinationPath);
    fs.ensureDirSync(destination);
    fs.writeJsonSync(`${destination}/index.json`, courseIndex, { spaces: 2 });
    R.forEachObjIndexed((md, path) => {
      fs.outputFileSync(`${destination}/${path}`, md);
    }, markdownFiles);
  }
}

function buildCourseLevel(source, levelXmlPath, level) {
  const levelIndex = {};
  const levelXml = fs.readFileSync(levelXmlPath, 'utf8');
  const levelJs = parseXml(levelXml, { compact: true });
  const nextLevel = nextLevelMap[level];
  if (nextLevel) {
    const children = R.pipe(
      R.pathOr([], [level, nextLevel]),
      R.of,
      R.unnest
    )(levelJs);

    if (level !== 'html') {
      levelIndex.name = levelJs[level]._attributes.display_name;
    }
    const childrenName = level === 'vertical' ? 'component' : nextLevel;
    levelIndex[childrenName] = R.map((child) => {
      const nextXmlPath = path.resolve(
        `${source}/${nextLevel}/${child._attributes.url_name}.xml`
      );
      return buildCourseLevel(source, nextXmlPath, nextLevel);
    }, children);
    if (
      level === 'vertical' &&
      R.hasPath(['vertical', 'deliverable', '_attributes'], levelJs)
    ) {
      levelIndex[childrenName] = R.pipe(
        R.path(['vertical', 'deliverable', '_attributes']),
        R.pick([
          'display_name',
          'deliverable_identifier',
          'deliverable_description',
        ]),
        R.mergeRight({ type: 'deliverable' }),
        R.append(R.__, levelIndex[childrenName])
      )(levelJs);
    }
  } else {
    return { type: 'html', file: levelJs.html._attributes.filename };
  }
  return levelIndex;
}

const axios = require('axios');
const AWS = require('aws-sdk');
AWS.config.loadFromPath('src/aws.json');
const s3 = new AWS.S3();

const uploadFileToS3 = async (url, key) => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    responseEncoding: 'binary',
  });
  const params = {
    ContentType: response.headers['content-type'],
    ContentLength: response.headers['content-length'],
    Bucket: 'ih-materials',
    Body: response.data,
    Key: key,
  };
  return s3.putObject(params).promise();
};
