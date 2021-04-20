const { Command, flags } = require("@oclif/command");

const md2oedx = require("./md2oedx");
const oedx2md = require("./oedx2md");

class Md2OedxCommand extends Command {
  async run() {
    const { args, flags } = this.parse(Md2OedxCommand);
    try {
      if (flags.reverse) {
        await oedx2md(args.source, args.destination);
      } else {
        await md2oedx(args.source, args.destination);
      }

      process.exit();
    } catch (error) {
      console.log("EAWEAWEAWE", error);
      process.exit(1);
    }
  }
}

Md2OedxCommand.args = [
  {
    name: "source",
    required: false,
    description: "Source path",
    default: "./",
  },
  {
    name: "destination",
    required: false,
    description: "Destination path",
    default: "./",
  },
];

Md2OedxCommand.description = `Translates markdown and a structure json file
into an importable Open Edx course`;

Md2OedxCommand.flags = {
  // add --reverse to make an oedx to md conversion
  reverse: flags.boolean({
    char: "r",
    default: false,
  }),
  // add --version flag to show CLI version
  version: flags.version({
    char: "v",
  }),
  // add --help flag to show CLI help
  help: flags.help({
    char: "h",
  }),
};

module.exports = Md2OedxCommand;
