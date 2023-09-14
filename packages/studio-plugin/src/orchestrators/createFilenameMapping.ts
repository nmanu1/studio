import fs from "fs";
import upath from "upath";

export default function createFilenameMapping<T>(
  dirPath: string,
  getMappedValue: (name: string) => T
): Record<string, T> {
  const files = fs.readdirSync(dirPath, "utf-8").filter((filename) => {
    const absPath = upath.join(dirPath, filename);
    return fs.lstatSync(absPath).isFile();
  });
  return files.reduce((filepathMapping, filename) => {
    const name = upath.basename(filename, ".tsx");
    filepathMapping[name] = getMappedValue(name);
    return filepathMapping;
  }, {} as Record<string, T>);
}
