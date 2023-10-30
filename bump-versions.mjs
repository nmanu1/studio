import { execSync } from "child_process";
import fs from "fs";

const newVersion = process.argv[2];

function bumpStudio() {
  const packageJsonPath = "./packages/studio/package.json";
  const packageJson = readJson(packageJsonPath);
  packageJson.dependencies["@yext/studio-plugin"] = newVersion;
  packageJson.dependencies["@yext/studio-ui"] = newVersion;
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n"
  );
  bumpPackage("studio");
  execSync("npm i");
}

function bumpPackage(packageName) {
  console.log(`... bumping ${packageName}`);
  execSync(
    `npm version ${newVersion} -w=packages/${packageName} --workspaces-update=false`
  );
}

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function main() {
  try {
    bumpPackage("studio-plugin");
  } catch (e) {
    console.error(e)
  }

  try {
    bumpPackage("studio-ui");
  } catch (e) {
    console.error(e);
  }

  bumpStudio();
}

main();
