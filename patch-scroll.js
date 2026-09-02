const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/querySelector\('#modal-view-record \.modal-body'\)/g, "querySelector('#modal-view-record .modal-content')");

fs.writeFileSync('js/app.js', code);
console.log("Fixed AutoScroll target");
