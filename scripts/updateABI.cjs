const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, '../artifacts/contracts/EIP7702AutoForwarder.sol/EIP7702AutoForwarder.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const targetPath = path.join(__dirname, '../src/services/contractABI.js');
let content = fs.readFileSync(targetPath, 'utf8');

const newAbiStr = JSON.stringify(artifact.abi, null, 4);
const newBytecodeStr = `"${artifact.bytecode}"`;

content = content.replace(/export const EIP7702_AUTO_FORWARDER_ABI = \[[\s\S]*?\];(\r?\n)/, `export const EIP7702_AUTO_FORWARDER_ABI = ${newAbiStr};\n`);
content = content.replace(/const EIP7702_AUTO_FORWARDER_BYTECODE = ".*?";/, `const EIP7702_AUTO_FORWARDER_BYTECODE = ${newBytecodeStr};`);

fs.writeFileSync(targetPath, content);
console.log('contractABI.js updated successfully');
