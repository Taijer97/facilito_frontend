import fs from 'fs';

const file = 'src/pages/RaffleDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000]"',
    'className="bg-white border-2 border-black rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-[4px_4px_0px_0px_#000] space-y-4 md:space-y-6"'
);
content = content.replace(
    /className="relative bg-white border-4 border-black rounded-3xl p-6 shadow-\[8px_8px_0px_0px_#000\]"/g,
    'className="relative bg-white border-2 md:border-4 border-black rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-[4px_4px_0px_0px_#000] md:shadow-[6px_6px_0px_0px_#000]"'
);

content = content.replace(
    'className="text-xl font-bold bg-green-100 p-4 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] text-left"',
    'className="text-base md:text-xl font-bold bg-green-100 p-3 md:p-4 border-2 md:border-4 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] text-left"'
);

content = content.replace(
    /className="text-xl font-bold bg-yellow-100 p-4 border-4 border-black rounded-xl shadow-\[4px_4px_0px_0px_#000\] text-left"/g,
    'className="text-base md:text-xl font-bold bg-yellow-100 p-3 md:p-4 border-2 md:border-4 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] text-left"'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Step 3 optimized');
