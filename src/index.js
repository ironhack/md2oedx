const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const { Command, flags } = require('@oclif/command');
const fs = require('fs-extra');
const R = require('ramda');
const targz = require('targz');

const filesCreator = require('./files_creator');

class Md2OedxCommand extends Command {
  async run() {
    const { args } = this.parse(Md2OedxCommand);
    const source = path.resolve(args.source);
    const temp = `${os.tmpdir()}/md2oedx-${Date.now()}`;

    let index;
    if (fs.existsSync(source) && fs.lstatSync(source).isFile()) {
      //
      // `source` is a file, like `path/to/index.yaml`
      //

      // Support YAML
      if (source.endsWith('.yaml')) {
        index = yaml.safeLoad(fs.readFileSync(source, 'utf8')); // load yaml file
      } else {
        index = require(`${source}`); // load json/js file
      }

    } else {
      //
      // `source` is a directory, like `path/to`
      //

      index = require(`${source}/index.json`); // default to `index.json` if no specified file
    }

    const xmlFilesMap = filesCreator.createXmlFiles(index);
    const mdFilesMap = filesCreator.createMdFiles(path.dirname(source));
    R.pipe(
      R.merge,
      R.toPairs,
      R.map(R.adjust(0, R.concat(`${temp}/`))),
      R.map(R.apply(fs.outputFileSync))
    )(xmlFilesMap, mdFilesMap);
    targz.compress(
      {
        src: temp,
        dest: `${args.destination}/course.tar.gz`
      },
      function(error) {
        if (error) {
          console.log(error);
        } else {
          console.log('Done!');
          // the HackMD parser keeps the program open so exit explicitly
          process.exit();
        }
      }
    );
  }
}

Md2OedxCommand.args = [
  {
    name: 'source',
    required: false,
    description: 'Source path to look for index.json and markdown files',
    default: './'
  },
  {
    name: 'destination',
    required: false,
    description: 'Destination path of the generated tarball',
    default: './'
  }
];

Md2OedxCommand.description = `Translates markdown and a structure json file
into an importable Open Edx course`;

Md2OedxCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({
    char: 'v'
  }),
  // add --help flag to show CLI version
  help: flags.help({
    char: 'h'
  })
};

module.exports = Md2OedxCommand;
