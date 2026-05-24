import fs from 'fs';

const file = 'src/pages/RaffleDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'className="bg-white border-2 border-black rounded-2xl p-4 shadow-[2px_2px_0px_0px_#000] space-y-6"',
    'className="bg-white border-2 border-black rounded-xl md:rounded-2xl p-3 md:p-4 shadow-[2px_2px_0px_0px_#000] space-y-3 md:space-y-6"'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Payment space optimized');
