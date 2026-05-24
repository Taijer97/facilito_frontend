import fs from 'fs';

const file = 'src/pages/RaffleDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    '<div className="bg-white rounded-2xl p-5 border-2 border-black space-y-2 md:space-y-4 shadow-[2px_2px_0px_0px_#000] transform rotate-1">',
    '<div className="bg-white rounded-xl p-3 md:p-5 border-2 border-black space-y-2 md:space-y-4 shadow-[2px_2px_0px_0px_#000] transform rotate-1">'
);

content = content.replace(
    '<div className="flex justify-between items-start text-lg font-bold border-b-2 border-gray-200 pb-3">',
    '<div className="flex justify-between items-start text-base md:text-lg font-bold border-b-2 border-gray-200 pb-2 md:pb-3">'
);

content = content.replace(
    'className="w-12 h-12 rounded-lg border-2 border-black object-cover shadow-[2px_2px_0px_0px_#000]"',
    'className="w-10 h-10 md:w-12 md:h-12 rounded-lg border-2 border-black object-cover shadow-[2px_2px_0px_0px_#000]"'
);

content = content.replace(
    'className="text-red-500 text-xl leading-none mt-1"',
    'className="text-red-500 text-lg md:text-xl leading-none mt-1"'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Prize list optimized');
