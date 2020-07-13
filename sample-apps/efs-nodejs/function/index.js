var fs = require('fs').promises
const crypto = require('crypto')
const dir = process.env.mountPath
const s3 = new (require("aws-sdk/clients/s3"))()

exports.handler = async function(event) {
  console.log("EVENT: %s", JSON.stringify(event, null, 2))
  const filePath = dir + "/" + event.fileName
  const fileSize = event.fileSize

  // generate file
  const buffer = await crypto.randomBytes(fileSize)

  // write operations
  const efsWriteTimeMs = await writeFileToEFS(filePath, buffer)
  const s3WriteTimeMs = await writeFileToS3(filePath, buffer)

  // read operations
  let count = process.env.readIterations || 1
  const efsReadTimesMs = [];
  const s3ReadTimesMs = [];

  while (count) {
    efsReadTimesMs.push(await readFileFromEFS(filePath));
    s3ReadTimesMs.push(await readFileFromS3(filePath));
    --count;
  }

  // stat file
  const fileStat = await fs.stat(filePath)
  const fileSizeBytes = fileStat.size
  console.log("File size: %s bytes", fileSizeBytes)

  // format response
  var response = {
    efsWriteTimeMs,
    s3WriteTimeMs,
    avEfsReadTimeMs: mean(efsReadTimesMs),
    avS3ReadTimeMs: mean(s3ReadTimesMs),
    fileSizeBytes: fileSizeBytes,
  };
  return response
}

var mean = numbers => (numbers.reduce(sum) / numbers.length)

var sum = (acc, curr) => acc + curr;

var readFileFromEFS = async function(filePath){
  console.log("Attempting to read file from EFS: %s", filePath)
  const readstart = process.hrtime()
  let fileContents
  try {
    fileContents = await fs.readFile(filePath, "utf8")
    const readend = process.hrtime(readstart)
    const readTimeMs = readend[0] * 1000 + readend[1] / 1000000
    console.log("Read completed in %dms", readTimeMs)
    return readTimeMs
  } catch (error){
    console.error(error)
    return "Read error: " + error
  }
}

var readFileFromS3 = async function (filePath) {
  console.log("Attempting to read file from S3: %s", filePath);
  const readstart = process.hrtime();
  let fileContents;
  try {
    fileContents = await s3.getObject({
      Bucket: process.env.bucket,
      Key: filePath
    }).promise();
    const readend = process.hrtime(readstart);
    const readTimeMs = readend[0] * 1000 + readend[1] / 1000000;
    console.log("Retrieved %d bytes from S3", new Blob([fileContents]).size);
    console.log("Read completed in %dms", readTimeMs);
    return readTimeMs;
  } catch (error) {
    console.error(error);
    return "Read error: " + error;
  }
};

var writeFileToEFS = async function(filePath, buffer){
  console.log("Attempting to write file to EFS: %s", filePath)
  try {
    const fileBase64 = buffer.toString("base64");
    const writestart = process.hrtime();
    fs.writeFile(filePath, fileBase64)
    const writeend = process.hrtime(writestart)
    const writeTimeMs = writeend[0] * 1000 + writeend[1] / 1000000
    console.log("Write to EFS completed in %dms", writeTimeMs);
    return writeTimeMs
  } catch (error){
    console.error(error)
    return "Write error: " + error
  }
}

var writeFileToS3 = async function (filePath, buffer) {
  console.log("Attempting to write file to S3: %s", filePath);
  try {
    const fileBase64 = buffer.toString("base64");
    const writestart = process.hrtime();
    await s3.putObject({
      Body: fileBase64,
      Bucket: process.env.bucket,
      Key: filePath
    }).promise();
    const writeend = process.hrtime(writestart);
    const writeTimeMs = writeend[0] * 1000 + writeend[1] / 1000000;
    console.log("Write to S3 completed in %dms", writeTimeMs);
    return writeTimeMs;
  } catch (error) {
    console.error(error);
    return "Write error: " + error;
  }
}