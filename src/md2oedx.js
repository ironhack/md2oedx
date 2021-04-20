const path = require("path");
const os = require("os");
const yaml = require("js-yaml");

const fs = require("fs-extra");
const hackmdToHtml = require("hackmd-to-html");
const klaw = require("klaw-sync");
const R = require("ramda");
const tar = require("tar");
const xml = require("xmlbuilder");
const xmlFormatter = require("xml-formatter");

const typeChild = {
  course: "chapter",
  chapter: "sequential",
  sequential: "vertical",
  vertical: "component",
};

const deliverableKeys = [
  "display_name",
  "deliverable_identifier",
  "deliverable_description",
  "deliverable_duedate",
];

module.exports = md2oedx;

async function md2oedx(sourcePath, destinationPath) {
  const source = path.resolve(sourcePath);
  const temp = `${os.tmpdir()}/md2oedx-${Date.now()}`;

  let index;
  if (fs.existsSync(source) && fs.lstatSync(source).isFile()) {
    //
    // `source` is a file, like `path/to/index.yaml`
    //

    // Support YAML
    if (source.endsWith(".yaml")) {
      index = yaml.safeLoad(fs.readFileSync(source, "utf8")); // load yaml file
    } else {
      index = require(`${source}`); // load json/js file
    }
  } else {
    //
    // `source` is a directory, like `path/to`
    //

    index = require(`${source}/index.json`); // default to `index.json` if no specified file
  }

  const xmlFilesMap = createXmlFiles(index);
  const mdFilesMap = createMdFiles(path.dirname(source));
  R.pipe(
    R.merge,
    R.toPairs,
    R.map(R.adjust(0, R.concat(`${temp}/`))),
    R.map(R.apply(fs.outputFileSync))
  )(xmlFilesMap, mdFilesMap);
  const destination = path.resolve(destinationPath);
  fs.ensureDirSync(destination);
  await tar.c({ file: `${destination}/course.tar.gz` }, [temp]);
}

// Private functions
function createMdFiles(sourcePath) {
  const markdownFiles = R.pipe(
    klaw,
    R.pluck("path"),
    R.filter(R.endsWith(".md")),
    R.map(R.replace(sourcePath, "")),
    R.juxt([
      R.map(
        R.pipe(
          R.slice(1, Infinity),
          R.replace(/\//g, "-"),
          R.replace(/.md$/, ".html"),
          R.concat("html/")
        )
      ),
      R.map(
        R.pipe(
          R.concat(`${sourcePath}`),
          fs.readFileSync,
          R.invoker(0, "toString"),
          hackmdToHtml
        )
      ),
    ]),
    R.apply(R.zip),
    R.fromPairs
  )(sourcePath);

  return markdownFiles;
}

function createXmlFiles(index) {
  let files = {
    "course.xml": xml
      .create({
        course: {
          "@url_name": "ironhack-course",
          "@org": "IRONHACK",
          "@course": index.course.number,
        },
      })
      .toString(),
  };
  buildTree(files, "ironhack", index.course, 0, "course");
  return files;
}

function buildTree(files, fileName, node, nodeIndex, nodeType) {
  nodeType = getRealType(nodeType, node.type);

  // deliverables don't need individual files created
  if (nodeType === "deliverable") {
    return;
  }

  const childType = typeChild[nodeType];
  const children = R.propOr([], childType, node);
  const nodeFileName = `${fileName}-${R.replace(
    "_0",
    "",
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
      "@display_name": nodeInfo.name,
      "@filename": nodeInfo.file
        ? R.slice(0, -3, R.replace(/\//g, "-", nodeInfo.file))
        : undefined,
    },
  };

  // use reduce() and ele() to build children
  // (they vary in types and attributes)
  const node = R.addIndex(R.reduce)(
    (acc, child, index) => {
      const realType = getRealType(childrenType, child.type);
      const childXml = {
        url_name: `${fileName}-${R.replace("_0", "", `${realType}_${index}`)}`,
      };
      return acc
        .ele(
          realType,
          R.ifElse(
            R.propEq("type", "deliverable"),
            R.pipe(R.pick(deliverableKeys), R.mergeRight(childXml)),
            R.always(childXml)
          )(child)
        )
        .up();
    },
    xml.create(xmlObject),
    children
  );
  return xmlFormatter(node.toString());
}

function getRealType(originalType, subtype) {
  return R.when(
    R.equals("component"),
    R.always(subtype || "html"),
    originalType
  );
}
