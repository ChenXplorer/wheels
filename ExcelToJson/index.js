const xlsx = require('node-xlsx');
const fs = require('fs');

const list = xlsx.parse('your.xlsx');

/* 
 // your data handle code
const light = [];
const dark = [];
const TokenMap = [];

const arr = list[2].data.filter((v) => v.length).map((v) => [v[0], v[1]]);
for (let i = 1; i < arr.length; i++) {
  TokenMap.push(`--${arr[i][0]}: var(${arr[i][1].replace(/\#/g, '--')})`);
}

const colorMapArr = list[1].data.filter((v) => v.length).map((v) => [v[0], v[1], v[2]]);
for (let i = 1; i < colorMapArr.length; i++) {
  const key = colorMapArr[i][0].replace(/\#/g, '--');
  light.push(key + ':' + colorMapArr[i][1]);
  dark.push(key + ':' + colorMapArr[i][2]);
}
function addRoot(data) {
  return ':root{' + data.join(';') + '}';
}



writeFile('light.css', addRoot(light));
writeFile('dark.css', addRoot(dark));
writeFile('map.css', addRoot(TokenMap));

*/
writeFile('yourOutputFileName', list);

function writeFile(name, data) {
  fs.writeFile(name, data, (err) => {
    if (!err) {
      console.log('文件生成success');
    }
  });
}
