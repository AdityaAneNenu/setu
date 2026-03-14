const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if(!file.includes('node_modules')) results = results.concat(walk(file));
    } else {
      if(file.endsWith('.js') || file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const allFiles = walk('./src');
allFiles.push('App.js');

const colorMap = {
  background: '#FFFFFF',
  backgroundGray: '#F5F5F8',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBg: '#FFFFFF',
  text: '#000000',
  textLight: '#888888',
  textMuted: '#B0B0B0',
  accent: '#FA4A0C',
  border: '#E0E0E0',
  danger: '#F44336', 
  success: '#4CAF50',
  statusBarStyle: 'dark-content',
  iconInactive: '#BDBDBD',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E0E0E0'
};

allFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let styleIdx = content.indexOf('StyleSheet.create');
  
  if(styleIdx > -1) {
    let beforeStyle = content.slice(0, styleIdx);
    let afterStyle = content.slice(styleIdx);
    let changed = false;
    
    // Replace colors.property and theme.colors.property
    let newAfterStyle = afterStyle.replace(/(?:colors|theme\.colors)\.([a-zA-Z]+)/g, (match, p1) => {
      changed = true;
      if(colorMap[p1]) return "'" + colorMap[p1] + "'";
      else {
        console.log(`Unmapped color in ${f}: ${p1}`);
        return match;
      }
    });

    if(changed) {
      if (beforeStyle + newAfterStyle !== content) {
        fs.writeFileSync(f, beforeStyle + newAfterStyle, 'utf8');
        console.log('Fixed', f);
      }
    }
  }
});
