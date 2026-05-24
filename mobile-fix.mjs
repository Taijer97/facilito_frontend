import fs from 'fs';

const file = 'src/pages/RaffleDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix image aspect ratio for mobile
content = content.replace(
    'aspect-square flex items-center justify-center transform -rotate-2 hover:rotate-0 transition-transform',
    'aspect-[16/9] md:aspect-square flex items-center justify-center transform -rotate-2 hover:rotate-0 transition-transform max-h-48 md:max-h-none object-cover mx-auto'
);

// Reduce spacing in left panel
content = content.replace('mb-6 bg-white aspect', 'mb-4 bg-white aspect');
content = content.replace('className="text-lg font-comic text-black mb-3 leading-none drop-shadow-[2px_2px_0px_#fff]"', 'className="text-xl md:text-2xl font-comic text-black mb-2 leading-none drop-shadow-[2px_2px_0px_#fff]"');
content = content.replace('mb-6 bg-white p-3', 'mb-3 bg-white p-2 md:p-3 text-sm md:text-base');
content = content.replace('space-y-4 shadow', 'space-y-2 md:space-y-4 shadow');

// Compact the "COMPRA TUS TICKETS" section
content = content.replace('<div className="space-y-8">', '<div className="space-y-4 md:space-y-6">');
content = content.replace('border-b-4 border-black pb-4', 'border-b-2 border-black pb-2 md:border-b-4 md:pb-4');
content = content.replace('space-x-6 bg-yellow-100 p-4', 'space-x-3 md:space-x-6 bg-yellow-100 p-3 md:p-4');
content = content.replace(/w-14 h-14/g, 'w-10 h-10 md:w-14 md:h-14');

// Payment method section
content = content.replace('<div className="space-y-6">', '<div className="space-y-3 md:space-y-6">');
content = content.replace('space-x-3 mb-6 border-b-4', 'space-x-3 mb-3 md:mb-6 border-b-2 md:border-b-4');
content = content.replace('grid grid-cols-2 gap-4 mb-4', 'grid grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-4');
// 'p-4 rounded-xl border-2' for payment buttons
content = content.replace(/p-4 rounded-xl border-2 transition-all flex items-center/g, 'p-2 md:p-4 rounded-xl border-2 transition-all flex items-center');

// General padding on right column
content = content.replace('md:w-1/2 p-4 bg-white relative', 'md:w-1/2 p-3 md:p-4 bg-white relative');

fs.writeFileSync(file, content, 'utf8');
console.log('Mobile layout optimized');
