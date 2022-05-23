const xlsx = require('node-xlsx');
const fs = require('fs');

const list = xlsx.parse('./color.xlsx');
const hexPercentMap = getHexPercentMap();

// your data handle code
const light = [];
const light_U = [];
const dark = [];
const TokenMap = [];

const arr = list[2].data.filter((v) => v.length).map((v) => [v[0], v[1]]);
for (let i = 1; i < arr.length; i++) {
  TokenMap.push(`--${arr[i][0].toLowerCase()}: var(${arr[i][1].replace(/\#/g, '--')})`);
}

const colorMapArr = list[1].data.filter((v) => v.length).map((v) => [v[0], v[1], v[2]]);

for (let i = 1; i < colorMapArr.length; i++) {
  const key = colorMapArr[i][0].replace(/\#/g, '--');
  light.push(key + ':' + handleHex(colorMapArr[i][1]));
  dark.push(key + ':' + handleHex(colorMapArr[i][2]));
  const key_u = formatLight_u(key);
  if (key_u) {
    light_U.push(key_u + ':' + handleHex(colorMapArr[i][1]));
  }
}

writeFile('light.css', addRoot(light));
writeFile('dark.css', addRoot(dark));
writeFile('map.css', addRoot(TokenMap));
writeFile('light_u.css', addRoot(light_U));

function addRoot(data) {
  return ':root{' + data.join(';') + '}';
}

function formatLight_u(key) {
  if (!key.includes('_')) {
    return key + '_u';
  } else {
    return false;
  }
}

function handleHex(hex) {
  if (hex.length === 9) {
    return handle_8_hex(hex);
  }
  return hex;
}

function handle_8_hex(hex) {
  const percent = hexPercentMap[hex.slice(1, 3)];
  return hexToRgba(hex.slice(3, 10), percent);
}

function getHexPercentMap() {
  const map = {};
  for (let i = 1; i >= 0; i -= 0.01) {
    i = Math.round(i * 100) / 100;
    let alpha = Math.round(i * 255);
    const hex = (alpha + 0x10000).toString(16).substr(-2).toUpperCase();
    const percent = Math.round(i * 100) + '%';
    map[hex] = percent;
  }
  return map;
}

function hexToRgba(hex, opacity) {
  return (
    'rgba(' +
    parseInt('0x' + hex.slice(0, 2)) +
    ',' +
    parseInt('0x' + hex.slice(2, 4)) +
    ',' +
    parseInt('0x' + hex.slice(4, 6)) +
    ',' +
    opacity +
    ')'
  );
}

// writeFile('yourOutputFileName', list);

function writeFile(name, data) {
  fs.writeFile(name, data, (err) => {
    if (!err) {
      console.log('文件生成success');
    }
  });
}
