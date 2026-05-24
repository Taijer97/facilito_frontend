import fs from 'fs';

const file = 'src/pages/RaffleDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

// Reduce left panel padding for mobile
content = content.replace(
    '<div className="md:w-1/2 bg-cyan-100 p-4 border-b-4 md:border-b-0 md:border-r-4 border-black">',
    '<div className="md:w-1/2 bg-cyan-100 p-3 md:p-6 border-b-4 md:border-b-0 md:border-r-4 border-black">'
);

// Right panel padding
content = content.replace(
    '<div className="md:w-1/2 p-3 md:p-4 bg-white relative">',
    '<div className="md:w-1/2 p-3 md:p-6 bg-white relative">'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Panels optimized');
